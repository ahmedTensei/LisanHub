"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issuesToFieldErrors, keepValues, type FormState } from "@/modules/account/forms";
import { isUiLocale, UI_LOCALES } from "@/modules/account/ui-locales";
import { canAccessStudio, canEditPlugin } from "@/modules/authorization/policies";
import {
  PluginActivity,
  PluginDraft,
  PluginId,
  PluginTemplate,
  Semver,
  type PluginDraft as Draft,
} from "@/modules/plugins/contract";
import { definitionFromDraft } from "@/modules/plugins/generate";
import { isValidJsonSchema } from "@/modules/plugins/json-schema";
import { definitionSha256 } from "@/modules/plugins/portable";
import { getSession } from "@/server/actor";
import {
  draftDefinitionKey,
  removeDefinitionFiles,
  versionDefinitionKey,
  writeDefinition,
  writeDraft,
} from "@/server/plugins/store";
import { getPluginLimits } from "@/server/queries/plugins";
import { getStudioPlugin, type StudioPluginRow } from "@/server/queries/studio";

/**
 * Plugin Studio actions (decisions R7 and R10). Every write goes through the
 * studio policy first, then row level security and the guard triggers decide
 * again. A draft is data: nothing here executes or imports it.
 */

function localeOf(value: string): string {
  return isUiLocale(value) ? value : "ar";
}

function text(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function localeText(formData: FormData, prefix: string, max: number): Record<string, string> {
  return Object.fromEntries(UI_LOCALES.map((l) => [l, text(formData, `${prefix}_${l}`, max)]));
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

async function loadEditable(id: unknown): Promise<{ row: StudioPluginRow; userId: string } | { error: string }> {
  const { actor } = await getSession();
  if (actor.kind !== "user") return { error: "sign_in_required" };
  if (!canAccessStudio(actor).allowed) return { error: "contributor_role_required" };
  if (typeof id !== "string") return { error: "invalid_input" };
  const row = await getStudioPlugin(id);
  if (!row) return { error: "not_found" };
  const decision = canEditPlugin(actor, { ownerId: row.ownerId, status: row.status, disabled: row.disabled });
  if (!decision.allowed) return { error: decision.reason };
  return { row, userId: actor.userId };
}

/**
 * A draft is a file (decision R13): the working copy is rewritten in the
 * owner's folder of the store, then the row records its key and hash. The
 * guard trigger refuses a key outside that folder.
 */
async function saveDraft(row: StudioPluginRow, next: Draft, locale: string): Promise<FormState> {
  const draft = PluginDraft.parse(next);
  const key = row.draftKey ?? draftDefinitionKey(row.ownerId, row.id);
  let written: { sha256: string };
  try {
    written = await writeDraft(key, draft);
  } catch {
    return { status: "error", error: "storage_unavailable" };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("plugins")
    .update({ draft_key: key, draft_sha256: written.sha256 })
    .eq("id", row.id);
  if (error) return { status: "error", error: "unexpected" };
  revalidatePath(`/${locale}/studio/${row.id}`, "layout");
  return { status: "ok", outcome: "saved" };
}

export async function createPlugin(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };
  if (!canAccessStudio(actor).allowed) return { status: "error", error: "contributor_role_required" };

  const values = keepValues(formData, ["plugin_id", "name_ar", "name_fr", "name_en"]);
  const pluginId = text(formData, "plugin_id", 60);
  const parsedId = PluginId.safeParse(pluginId);
  if (!parsedId.success) return { status: "error", fieldErrors: { plugin_id: "slug_invalid" }, values };
  const name = localeText(formData, "name", 120);
  if (name.en === "") return { status: "error", fieldErrors: { name_en: "required" }, values };

  // The row id is chosen here so the draft file can be written first, in the owner's folder.
  const id = crypto.randomUUID();
  const key = draftDefinitionKey(actor.userId, id);
  let written: { sha256: string };
  try {
    written = await writeDraft(key, PluginDraft.parse({ plugin_id: parsedId.data, name }));
  } catch {
    return { status: "error", error: "storage_unavailable", values };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugins")
    .insert({ id, plugin_id: parsedId.data, owner_id: actor.userId, draft_key: key, draft_sha256: written.sha256 })
    .select("id")
    .single();
  if (error) {
    await removeDefinitionFiles([key]);
    if (error.code === "23505") return { status: "error", fieldErrors: { plugin_id: "slug_taken" }, values };
    return { status: "error", error: "unexpected", values };
  }
  redirect(`/${uiLocale}/studio/${data.id}`);
}

export async function savePluginInfo(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;

  const version = text(formData, "version", 20);
  if (!Semver.safeParse(version).success) return { status: "error", fieldErrors: { version: "version_invalid" } };
  const schemaVersion = Number(text(formData, "schema_version", 5));
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1)
    return { status: "error", fieldErrors: { schema_version: "invalid" } };

  const next: Draft = {
    ...row.draft,
    name: localeText(formData, "name", 120),
    description: localeText(formData, "description", 500),
    version,
    schema_version: schemaVersion,
    assets_allowed: formData.get("assets_image") === "on" ? ["image"] : [],
  };
  return saveDraft(row, next, uiLocale);
}

export async function savePluginActivity(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;

  const parsed = PluginActivity.safeParse(payloadOf(formData));
  if (!parsed.success)
    return { status: "error", error: "activity_invalid", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const activity = parsed.data;
  const original = text(formData, "original", 60) || activity.id;
  const keys = new Set(activity.fields.map((f) => f.key));
  if (keys.size !== activity.fields.length) return { status: "error", error: "field_key_duplicate" };

  const others = row.draft.activities.filter((a) => a.id !== original);
  if (others.some((a) => a.id === activity.id)) return { status: "error", error: "activity_id_duplicate" };
  const index = row.draft.activities.findIndex((a) => a.id === original);
  const activities = [...row.draft.activities];
  if (index >= 0) activities[index] = activity;
  else activities.push(activity);

  const state = await saveDraft(row, { ...row.draft, activities }, uiLocale);
  if (state.status === "ok" && index < 0) redirect(`/${uiLocale}/studio/${row.id}/activities`);
  return state;
}

export async function removePluginActivity(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;
  const activityId = text(formData, "activity", 60);
  const activities = row.draft.activities.filter((a) => a.id !== activityId);
  const templates = row.draft.templates
    .map((t) => ({ ...t, items: t.items.filter((i) => i.activity !== activityId) }))
    .filter((t) => t.items.length > 0);
  const state = await saveDraft(row, { ...row.draft, activities, templates }, uiLocale);
  if (state.status === "ok") redirect(`/${uiLocale}/studio/${row.id}/activities`);
  return state;
}

export async function movePluginActivity(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;
  const activityId = text(formData, "activity", 60);
  const direction = text(formData, "direction", 4) === "up" ? -1 : 1;
  const activities = [...row.draft.activities];
  const index = activities.findIndex((a) => a.id === activityId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= activities.length) return { status: "ok" };
  [activities[index], activities[target]] = [activities[target], activities[index]];
  return saveDraft(row, { ...row.draft, activities }, uiLocale);
}

export async function savePluginTemplate(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;

  const parsed = PluginTemplate.safeParse(payloadOf(formData));
  if (!parsed.success)
    return { status: "error", error: "template_invalid", fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const template = parsed.data;
  const limits = await getPluginLimits();
  const original = text(formData, "original", 60) || template.id;
  const others = row.draft.templates.filter((t) => t.id !== original);
  if (others.some((t) => t.id === template.id)) return { status: "error", error: "template_id_duplicate" };
  if (template.items.some((i) => !row.draft.activities.some((a) => a.id === i.activity))) {
    return { status: "error", error: "template_activity_missing" };
  }
  const index = row.draft.templates.findIndex((t) => t.id === original);
  const templates = [...row.draft.templates];
  if (index >= 0) templates[index] = template;
  else templates.push(template);
  if (templates.length > limits.max_templates) return { status: "error", error: "templates_too_many" };

  const state = await saveDraft(row, { ...row.draft, templates }, uiLocale);
  if (state.status === "ok" && index < 0) redirect(`/${uiLocale}/studio/${row.id}/templates`);
  return state;
}

export async function removePluginTemplate(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;
  const templateId = text(formData, "template", 60);
  const templates = row.draft.templates.filter((t) => t.id !== templateId);
  const state = await saveDraft(row, { ...row.draft, templates }, uiLocale);
  if (state.status === "ok") redirect(`/${uiLocale}/studio/${row.id}/templates`);
  return state;
}

export async function savePluginAdvanced(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;

  const custom = formData.get("custom") === "on";
  if (!custom) return saveDraft(row, { ...row.draft, custom_schema: false, content_schema: undefined }, uiLocale);

  const raw = text(formData, "schema", 300_000);
  let schema: unknown;
  try {
    schema = JSON.parse(raw);
  } catch {
    return { status: "error", fieldErrors: { schema: "json_invalid" }, values: { schema: raw } };
  }
  if (!isValidJsonSchema(schema))
    return { status: "error", fieldErrors: { schema: "schema_invalid" }, values: { schema: raw } };
  return saveDraft(
    row,
    { ...row.draft, custom_schema: true, content_schema: schema as Record<string, unknown> },
    uiLocale,
  );
}

export async function submitPluginVersion(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;

  const limits = await getPluginLimits();
  const validation = definitionFromDraft(row.draft, limits);
  if (!validation.ok) return { status: "error", error: "definition_invalid" };
  const definition = validation.definition;
  const note = text(formData, "note", 500) || null;

  // The version file is immutable and written before the row that will name it (decision R13).
  const key = versionDefinitionKey(row.ownerId, crypto.randomUUID());
  try {
    await writeDefinition(key, definition);
  } catch {
    return { status: "error", error: "storage_unavailable" };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_plugin_version", {
    p_plugin: row.id,
    p_version: definition.version,
    p_schema_version: definition.schema_version,
    p_definition_key: key,
    p_sha256: definitionSha256(definition),
    p_note: note ?? undefined,
  });
  if (error) {
    await removeDefinitionFiles([key]);
    if (error.code === "23505") {
      return { status: "error", error: error.message.includes("one_pending") ? "request_pending" : "version_exists" };
    }
    if (error.message.includes("disabled plugin")) return { status: "error", error: "plugin_disabled" };
    return { status: "error", error: "unexpected" };
  }
  revalidatePath(`/${uiLocale}/studio`, "layout");
  revalidatePath(`/${uiLocale}/admin/plugins`);
  return { status: "ok", outcome: data === "published" ? "published" : "requested" };
}

export async function deletePluginDraft(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const loaded = await loadEditable(formData.get("id"));
  if ("error" in loaded) return { status: "error", error: loaded.error };
  const { row } = loaded;
  if (row.currentVersionId || row.status !== "draft") return { status: "error", error: "not_a_draft" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("plugins").delete().eq("id", row.id);
  if (error) return { status: "error", error: "unexpected" };
  if (row.draftKey) await removeDefinitionFiles([row.draftKey]);
  revalidatePath(`/${uiLocale}/studio`, "layout");
  redirect(`/${uiLocale}/studio?notice=deleted`);
}
