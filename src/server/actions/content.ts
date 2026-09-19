"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toJson } from "@/lib/supabase/json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issuesToFieldErrors, keepValues, type FieldErrors, type FormState } from "@/modules/account/forms";
import { isUiLocale } from "@/modules/account/ui-locales";
import type { FormErrorCode } from "@/modules/account/schemas";
import { canCreateContent, canEdit } from "@/modules/authorization/policies";
import { CourseInput, PackageMetadataInput, Title, translationsFromForm } from "@/modules/content/package-input";
import type { BuildInput } from "@/modules/packages/build";
import { moveItem, newItemId, removeItem, updateItem } from "@/modules/packages/items";
import { ASSET_CONTENT_TYPES, type AssetContentType } from "@/modules/packages/manifest";
import { assetExtension, sniffImageType } from "@/modules/packages/sniff";
import type { ContentItem, PluginActivity } from "@/modules/plugins/contract";
import { emptyFieldValue, fieldValueSchema } from "@/modules/plugins/fields";
import { authorable } from "@/modules/plugins/playable";
import { getSession } from "@/server/actor";
import {
  assetsOf,
  draftPackageKey,
  loadPackage,
  versionPackageKey,
  writeDraftPackage,
  writeVersionPackage,
} from "@/server/packages/store";
import { getOwnProfile } from "@/server/queries/account";
import { getContentItem, getContentVersion, type ContentRow } from "@/server/queries/content";
import { getPackageLimits, getPluginVersion, listCatalogue } from "@/server/queries/plugins";

/**
 * Content editor actions (decision R7): a package is a file rebuilt on every
 * save and validated in full before publication. Ownership goes through the
 * capability policies here and row level security in the database; the
 * package validator runs server-side on every write that reaches a file.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function localeOf(value: string): string {
  return isUiLocale(value) ? value : "ar";
}

function text(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function payloadOf(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

type Owned = { item: ContentRow; userId: string } | { error: string };

/** The item must exist, be visible (RLS) and be editable by the caller (owner or moderation, not under moderation). */
async function loadEditable(id: unknown): Promise<Owned> {
  const { actor } = await getSession();
  if (actor.kind !== "user") return { error: "sign_in_required" };
  if (typeof id !== "string" || !UUID.test(id)) return { error: "invalid_input" };
  const item = await getContentItem(id);
  if (!item) return { error: "not_found" };
  const decision = canEdit(actor, { ownerId: item.ownerId, status: item.status, isPaid: false });
  if (!decision.allowed) return { error: decision.reason };
  return { item, userId: actor.userId };
}

function revalidateContent(locale: string, id?: string) {
  revalidatePath(`/${locale}/content`, "layout");
  if (id) revalidatePath(`/${locale}/content/${id}`, "layout");
}

/** Loads the working copy of a package (draft mode: incomplete items allowed). */
async function loadDraft(item: ContentRow) {
  if (!item.packageKey) return { error: "package_missing" as const };
  const loaded = await loadPackage(item.packageKey, "draft");
  if (!loaded.ok)
    return {
      error: loaded.reason === "invalid" ? ("package_invalid" as const) : ("package_missing" as const),
      issues: loaded.ok ? undefined : loaded.issues,
    };
  return { loaded };
}

/** Rewrites the working copy and mirrors the index columns the database keeps. */
async function saveDraft(
  item: ContentRow,
  manifest: BuildInput["manifest"],
  content: { items: ContentItem[] },
  assets: BuildInput["assets"],
) {
  const key = item.packageKey ?? draftPackageKey(item.ownerId, item.id);
  const written = await writeDraftPackage(key, { manifest, content, assets });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_items")
    .update({ package_key: key, package_sha256: written.fileSha256, items_count: written.itemsCount })
    .eq("id", item.id);
  if (error) throw new Error(`content item: ${error.message}`);
  return written;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createPackage(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const allowed = canCreateContent(actor);
  if (!allowed.allowed || actor.kind !== "user")
    return { status: "error", error: allowed.allowed ? "sign_in_required" : allowed.reason };

  const values = keepValues(formData, ["plugin", "pair", "template", "title"]);
  const pluginVersionId = text(formData, "plugin", 40);
  const pairId = text(formData, "pair", 40);
  const templateId = text(formData, "template", 60);
  if (!UUID.test(pluginVersionId) || !UUID.test(pairId)) return { status: "error", error: "invalid_input", values };
  const parsedTitle = z.object({ title: Title }).safeParse({ title: formData.get("title") });
  if (!parsedTitle.success) {
    return { status: "error", fieldErrors: issuesToFieldErrors(parsedTitle.error.issues), values };
  }
  const title = parsedTitle.data.title;

  const [plugin, profile, catalogue] = await Promise.all([
    getPluginVersion(pluginVersionId),
    getOwnProfile(actor.userId),
    listCatalogue(),
  ]);
  if (!plugin || !catalogue.some((c) => c.versionId === pluginVersionId) || !authorable({ ...plugin.plugin })) {
    return { status: "error", error: "plugin_unavailable", values };
  }
  if (!profile) return { status: "error", error: "unexpected" };

  const supabase = await createSupabaseServerClient();
  const pair = await supabase
    .from("language_pairs")
    .select("native_lang, target_lang, dialect_tag")
    .eq("id", pairId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (pair.error || !pair.data) return { status: "error", error: "pair_invalid", values };

  const template = plugin.definition.templates.find((t) => t.id === templateId) ?? null;
  const items: ContentItem[] = (
    template ? template.items : [{ activity: plugin.definition.activities[0].id, hints: {} }]
  ).map((entry) => {
    const activity = plugin.definition.activities.find((a) => a.id === entry.activity) as PluginActivity;
    return {
      item_id: newItemId(),
      activity: activity.id,
      fields: Object.fromEntries(activity.fields.map((f) => [f.key, emptyFieldValue(f)])),
    };
  });

  const inserted = await supabase
    .from("content_items")
    .insert({
      kind: "package",
      owner_id: actor.userId,
      source_lang: pair.data.native_lang,
      target_lang: pair.data.target_lang,
      dialect_tag: pair.data.dialect_tag,
      title,
      plugin_id: plugin.pluginRowId,
      plugin_version_id: plugin.versionId,
      items_count: items.length,
    })
    .select("id")
    .single();
  if (inserted.error) return { status: "error", error: "unexpected", values };
  const itemId = inserted.data.id;

  const manifest: BuildInput["manifest"] = {
    format: "lisanhub.package/1",
    package_id: itemId,
    version: 0,
    plugin: { id: plugin.pluginId, version: plugin.version, schema_version: plugin.schemaVersion },
    language_pair: {
      source: pair.data.native_lang,
      target: pair.data.target_lang,
      ...(pair.data.dialect_tag ? { dialect: pair.data.dialect_tag } : {}),
    },
    cefr: null,
    cefr_sublevel: null,
    skills: [],
    tags: [],
    title,
    summary: "",
    license: null,
    author: { user_id: actor.userId, username: profile.username, display_name: profile.displayName },
    provenance: null,
    created_at: new Date().toISOString(),
  };
  const key = draftPackageKey(actor.userId, itemId);
  const written = await writeDraftPackage(key, { manifest, content: { items }, assets: {} });
  const updated = await supabase
    .from("content_items")
    .update({ package_key: key, package_sha256: written.fileSha256 })
    .eq("id", itemId);
  if (updated.error) return { status: "error", error: "unexpected", values };

  revalidateContent(uiLocale);
  redirect(`/${uiLocale}/content/${itemId}?notice=created`);
}

export async function createCourse(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const allowed = canCreateContent(actor);
  if (!allowed.allowed || actor.kind !== "user")
    return { status: "error", error: allowed.allowed ? "sign_in_required" : allowed.reason };

  const values = keepValues(formData, ["pair", "title", "summary"]);
  const parsed = CourseInput.safeParse({ title: formData.get("title"), summary: formData.get("summary") });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };
  const pairId = text(formData, "pair", 40);
  if (!UUID.test(pairId)) return { status: "error", error: "invalid_input", values };

  const supabase = await createSupabaseServerClient();
  const pair = await supabase
    .from("language_pairs")
    .select("native_lang, target_lang, dialect_tag")
    .eq("id", pairId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (pair.error || !pair.data) return { status: "error", error: "pair_invalid", values };

  const inserted = await supabase
    .from("content_items")
    .insert({
      kind: "course",
      owner_id: actor.userId,
      source_lang: pair.data.native_lang,
      target_lang: pair.data.target_lang,
      dialect_tag: pair.data.dialect_tag,
      title: parsed.data.title,
      summary: parsed.data.summary || null,
    })
    .select("id")
    .single();
  if (inserted.error) return { status: "error", error: "unexpected", values };
  revalidateContent(uiLocale);
  redirect(`/${uiLocale}/content/${inserted.data.id}?notice=created`);
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function updateMetadata(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;

  const values = keepValues(formData, [
    "title",
    "summary",
    "dialect",
    "cefr",
    "cefrSublevel",
    "tags",
    "title_ar",
    "summary_ar",
    "title_fr",
    "summary_fr",
  ]);
  const parsed = PackageMetadataInput.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    dialect: formData.get("dialect"),
    cefr: formData.get("cefr"),
    cefrSublevel: formData.get("cefrSublevel"),
    skills: formData.getAll("skills"),
    tags: formData.get("tags"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };
  const meta = parsed.data;
  if (meta.cefrSublevel !== null && meta.cefr === null)
    return { status: "error", fieldErrors: { cefrSublevel: "cefr_invalid" }, values };
  let translations: ReturnType<typeof translationsFromForm>;
  try {
    translations = translationsFromForm((name) => formData.get(name));
  } catch {
    return { status: "error", fieldErrors: { title_ar: "title_too_long" }, values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_items")
    .update({
      title: meta.title,
      summary: meta.summary || null,
      translations: toJson(translations),
      dialect_tag: meta.dialect ?? null,
      cefr_level: meta.cefr,
      cefr_sublevel: meta.cefrSublevel,
      skills: meta.skills,
      tags: meta.tags,
    })
    .eq("id", item.id);
  if (error) return { status: "error", error: "unexpected", values };

  if (item.kind === "package") {
    const draft = await loadDraft(item);
    if ("error" in draft) return { status: "error", error: draft.error };
    const { manifest, content } = draft.loaded.package;
    await saveDraft(
      item,
      {
        ...manifest,
        title: meta.title,
        summary: meta.summary,
        cefr: meta.cefr,
        cefr_sublevel: meta.cefrSublevel,
        skills: meta.skills,
        tags: meta.tags,
        language_pair: { ...manifest.language_pair, ...(meta.dialect ? { dialect: meta.dialect } : {}) },
      },
      content,
      assetsOf(draft.loaded.package),
    );
  }
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "saved" };
}

// ---------------------------------------------------------------------------
// Items of the working copy
// ---------------------------------------------------------------------------

async function activityOf(item: ContentRow, activityId: string): Promise<PluginActivity | null> {
  if (!item.pluginVersionId) return null;
  const plugin = await getPluginVersion(item.pluginVersionId);
  return plugin?.definition.activities.find((a) => a.id === activityId) ?? null;
}

export async function addItem(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const activity = await activityOf(item, text(formData, "activity", 60));
  if (!activity) return { status: "error", error: "invalid_input" };
  const draft = await loadDraft(item);
  if ("error" in draft) return { status: "error", error: draft.error };
  const { manifest, content } = draft.loaded.package;
  const next: ContentItem = {
    item_id: newItemId(),
    activity: activity.id,
    fields: Object.fromEntries(activity.fields.map((f) => [f.key, emptyFieldValue(f)])),
  };
  await saveDraft(item, manifest, { items: [...content.items, next] }, assetsOf(draft.loaded.package));
  revalidateContent(uiLocale, item.id);
  redirect(`/${uiLocale}/content/${item.id}/items/${next.item_id}`);
}

export async function removeContentItem(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const draft = await loadDraft(item);
  if ("error" in draft) return { status: "error", error: draft.error };
  const { manifest, content } = draft.loaded.package;
  const items = removeItem(content.items, text(formData, "item", 64));
  await saveDraft(item, manifest, { items }, assetsOf(draft.loaded.package));
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "saved" };
}

export async function moveContentItem(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const draft = await loadDraft(item);
  if ("error" in draft) return { status: "error", error: draft.error };
  const { manifest, content } = draft.loaded.package;
  const items = moveItem(content.items, text(formData, "item", 64), text(formData, "direction", 4) === "up" ? -1 : 1);
  await saveDraft(item, manifest, { items }, assetsOf(draft.loaded.package));
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "saved" };
}

/** Saves one item's fields after validating every field against the plugin's rules (item_id never changes). */
export async function saveContentItem(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const itemId = text(formData, "item", 64);
  const payload = payloadOf(formData);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { status: "error", error: "invalid_input" };
  const fields = payload as Record<string, unknown>;

  const draft = await loadDraft(item);
  if ("error" in draft) return { status: "error", error: draft.error };
  const { manifest, content } = draft.loaded.package;
  const existing = content.items.find((i) => i.item_id === itemId);
  if (!existing) return { status: "error", error: "not_found" };
  const activity = await activityOf(item, existing.activity);
  if (!activity) return { status: "error", error: "plugin_unavailable" };

  const fieldErrors: FieldErrors = {};
  const cleaned: Record<string, unknown> = {};
  for (const field of activity.fields) {
    const value = fields[field.key];
    const empty =
      value === undefined || value === null || value === "" || (typeof value === "object" && isBlank(value));
    if (empty) {
      if (field.required) fieldErrors[field.key] = "required";
      continue;
    }
    const result = fieldValueSchema(field).safeParse(value);
    if (!result.success) {
      fieldErrors[field.key] = (result.error.issues[0]?.message as FormErrorCode) ?? "invalid";
      continue;
    }
    if (field.type === "image" && !draft.loaded.package.assets.has((result.data as { asset: string }).asset)) {
      fieldErrors[field.key] = "asset_required";
      continue;
    }
    cleaned[field.key] = result.data;
  }
  const skill = text(formData, "skill", 20);
  if (Object.keys(fieldErrors).length > 0) return { status: "error", error: "fix_fields", fieldErrors };

  const items = updateItem(content.items, itemId, {
    fields: cleaned,
    ...(skill && skill !== activity.skill ? { skill: skill as ContentItem["skill"] } : { skill: undefined }),
  });
  await saveDraft(item, manifest, { items }, assetsOf(draft.loaded.package));
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "saved" };
}

function isBlank(value: object): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return Object.values(value as Record<string, unknown>).every(
    (v) => v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0),
  );
}

/** Adds a picture to the package (never a link) and points the field at it; alt text is mandatory. */
export async function uploadItemImage(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const itemId = text(formData, "item", 64);
  const fieldKey = text(formData, "field", 60);
  const alt = text(formData, "alt", 300);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", fieldErrors: { file: "required" } };
  if (alt === "") return { status: "error", fieldErrors: { alt: "required" } };

  const limits = await getPackageLimits();
  if (file.size > limits.max_asset_bytes) return { status: "error", fieldErrors: { file: "avatar_too_large" } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type || !(ASSET_CONTENT_TYPES as readonly string[]).includes(type))
    return { status: "error", fieldErrors: { file: "avatar_type_invalid" } };

  const draft = await loadDraft(item);
  if ("error" in draft) return { status: "error", error: draft.error };
  const { manifest, content } = draft.loaded.package;
  const existing = content.items.find((i) => i.item_id === itemId);
  if (!existing) return { status: "error", error: "not_found" };
  const activity = await activityOf(item, existing.activity);
  const field = activity?.fields.find((f) => f.key === fieldKey);
  if (!field || field.type !== "image") return { status: "error", error: "invalid_input" };

  const assets = assetsOf(draft.loaded.package);
  if (Object.keys(assets).length >= limits.max_assets) return { status: "error", error: "too_many_assets" };
  const path = `assets/${crypto.randomUUID()}.${assetExtension(type as AssetContentType)}`;
  assets[path] = { bytes, type: type as AssetContentType };
  const items = updateItem(content.items, itemId, { fields: { ...existing.fields, [fieldKey]: { asset: path, alt } } });
  await saveDraft(item, manifest, { items }, assets);
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "image_added" };
}

// ---------------------------------------------------------------------------
// Publish, rollback, archive
// ---------------------------------------------------------------------------

export async function publishPackage(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  if (item.kind !== "package" || !item.packageKey) return { status: "error", error: "invalid_input" };

  // Full validation of the working copy: limits, paths, types, hashes, schema, references.
  const loaded = await loadPackage(item.packageKey, "publish");
  if (!loaded.ok)
    return {
      status: "error",
      error: loaded.reason === "invalid" ? "package_invalid" : "package_missing",
      values: issuesToValues(loaded.ok ? [] : (loaded.issues ?? [])),
    };

  const supabase = await createSupabaseServerClient();
  const versionId = crypto.randomUUID();
  const key = versionPackageKey(item.ownerId, versionId);
  await writeVersionPackage(key, loaded.bytes);
  const version = await supabase
    .from("content_versions")
    .insert({
      id: versionId,
      item_id: item.id,
      package_key: key,
      package_sha256: loaded.package.fileSha256,
      plugin_version_id: loaded.pluginVersionId || item.pluginVersionId,
      items_count: loaded.package.content.items.length,
      author_id: owned.userId,
      change_note: text(formData, "note", 500) || null,
      // Assigned by the database trigger; the column has no default.
      version_number: 0,
    })
    .select("id")
    .single();
  if (version.error) return { status: "error", error: "unexpected" };
  const updated = await supabase
    .from("content_items")
    .update({
      status: "published",
      current_version_id: version.data.id,
      package_sha256: loaded.package.fileSha256,
      plugin_version_id: loaded.pluginVersionId || item.pluginVersionId,
      items_count: loaded.package.content.items.length,
    })
    .eq("id", item.id);
  if (updated.error) return { status: "error", error: "unexpected" };
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "published" };
}

function issuesToValues(issues: { code: string; path?: string }[]): Record<string, string> {
  return { issues: issues.map((i) => (i.path ? `${i.code}:${i.path}` : i.code)).join("\n") };
}

export async function rollbackPackage(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const versionId = text(formData, "version", 40);
  if (!UUID.test(versionId) || !item.packageKey) return { status: "error", error: "invalid_input" };
  const version = await getContentVersion(item.id, versionId);
  if (!version) return { status: "error", error: "not_found" };

  // The working copy becomes that version's file again, then the pointers move (audited).
  const loaded = await loadPackage(version.packageKey, "publish");
  if (!loaded.ok) return { status: "error", error: "package_missing" };
  await writeDraftPackage(item.packageKey, {
    manifest: loaded.package.manifest,
    content: loaded.package.content,
    assets: assetsOf(loaded.package),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rollback_content_version", { p_item: item.id, p_version: versionId });
  if (error)
    return { status: "error", error: error.message.includes("already the current") ? "already_current" : "unexpected" };
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "rolled_back" };
}

export async function setContentStatus(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const next = text(formData, "status", 20);
  if (next !== "archived" && next !== "published" && next !== "draft")
    return { status: "error", error: "invalid_input" };
  if (next === "published" && item.kind === "package" && !item.currentVersionId)
    return { status: "error", error: "publish_first" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_items").update({ status: next }).eq("id", item.id);
  if (error) return { status: "error", error: "unexpected" };
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: `status_${next}` };
}

// ---------------------------------------------------------------------------
// Courses (decision R11: the author's own packages only)
// ---------------------------------------------------------------------------

export async function addCourseLesson(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const lessonId = text(formData, "lesson", 40);
  if (item.kind !== "course" || !UUID.test(lessonId)) return { status: "error", error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const existing = await supabase
    .from("course_lessons")
    .select("position")
    .eq("course_id", item.id)
    .order("position", { ascending: false })
    .limit(1);
  if (existing.error) return { status: "error", error: "unexpected" };
  const position = (existing.data[0]?.position ?? -1) + 1;
  const { error } = await supabase.from("course_lessons").insert({ course_id: item.id, lesson_id: lessonId, position });
  if (error)
    return {
      status: "error",
      error:
        error.code === "23505"
          ? "already_in_course"
          : error.code === "42501"
            ? "own_packages_only"
            : error.code === "23514"
              ? "pair_mismatch"
              : "unexpected",
    };
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "lesson_added" };
}

export async function removeCourseLesson(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const lessonId = text(formData, "lesson", 40);
  if (!UUID.test(lessonId)) return { status: "error", error: "invalid_input" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("course_lessons").delete().eq("course_id", item.id).eq("lesson_id", lessonId);
  if (error) return { status: "error", error: "unexpected" };
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "lesson_removed" };
}

export async function moveCourseLesson(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const owned = await loadEditable(formData.get("id"));
  if ("error" in owned) return { status: "error", error: owned.error };
  const { item } = owned;
  const lessonId = text(formData, "lesson", 40);
  const direction = text(formData, "direction", 4) === "up" ? -1 : 1;
  const supabase = await createSupabaseServerClient();
  const rows = await supabase
    .from("course_lessons")
    .select("lesson_id, position")
    .eq("course_id", item.id)
    .order("position");
  if (rows.error) return { status: "error", error: "unexpected" };
  const order = rows.data.map((r) => r.lesson_id);
  const index = order.indexOf(lessonId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return { status: "ok" };
  [order[index], order[target]] = [order[target], order[index]];
  // Renumber every row so positions stay dense (positions are not unique, so one pass is enough).
  for (const [position, lesson] of order.entries()) {
    const { error } = await supabase
      .from("course_lessons")
      .update({ position })
      .eq("course_id", item.id)
      .eq("lesson_id", lesson);
    if (error) return { status: "error", error: "unexpected" };
  }
  revalidateContent(uiLocale, item.id);
  return { status: "ok", outcome: "saved" };
}
