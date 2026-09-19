import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CefrLevel, LanguageSkill } from "@/modules/content/levels";
import type { ContentTranslations } from "@/modules/content/package-input";

/**
 * Reads for the content editor ("my content"). Row level security already
 * limits drafts to their owner and moderation; these helpers shape the rows.
 */

export type ContentStatus = "draft" | "published" | "archived" | "hidden" | "removed";
export type ContentKind = "course" | "package" | "lesson" | "deck";

export interface ContentRow {
  id: string;
  kind: ContentKind;
  ownerId: string;
  title: string;
  summary: string | null;
  /** Optional translations of title and summary per interface language (decision R16). */
  translations: ContentTranslations;
  status: ContentStatus;
  sourceLang: string;
  targetLang: string;
  dialectTag: string | null;
  cefr: CefrLevel | null;
  cefrSublevel: number | null;
  skills: LanguageSkill[];
  tags: string[];
  license: string | null;
  pluginRowId: string | null;
  pluginVersionId: string | null;
  packageKey: string | null;
  packageSha256: string | null;
  itemsCount: number;
  currentVersionId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Why moderation hid the item (decision R17); null otherwise. */
  moderationNote: string | null;
  /** Slug and current version of the plugin the package is built on. */
  plugin: { pluginId: string; status: string; disabled: boolean } | null;
}

const COLUMNS =
  "id, kind, owner_id, title, summary, translations, status, source_lang, target_lang, dialect_tag, cefr_level, cefr_sublevel, skills, tags, license, plugin_id, plugin_version_id, package_key, package_sha256, items_count, current_version_id, published_at, created_at, updated_at, moderation_note, plugins(plugin_id, status, disabled)";

type Record_ = {
  id: string;
  kind: ContentKind;
  owner_id: string;
  title: string;
  summary: string | null;
  translations: unknown;
  status: ContentStatus;
  source_lang: string;
  target_lang: string;
  dialect_tag: string | null;
  cefr_level: CefrLevel | null;
  cefr_sublevel: number | null;
  skills: LanguageSkill[];
  tags: string[];
  license: string | null;
  plugin_id: string | null;
  plugin_version_id: string | null;
  package_key: string | null;
  package_sha256: string | null;
  items_count: number;
  current_version_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  moderation_note: string | null;
  plugins: { plugin_id: string; status: string; disabled: boolean } | null;
};

function toRow(r: Record_): ContentRow {
  return {
    id: r.id,
    kind: r.kind,
    ownerId: r.owner_id,
    title: r.title,
    summary: r.summary,
    translations: (r.translations && typeof r.translations === "object" ? r.translations : {}) as ContentTranslations,
    status: r.status,
    sourceLang: r.source_lang,
    targetLang: r.target_lang,
    dialectTag: r.dialect_tag,
    cefr: r.cefr_level,
    cefrSublevel: r.cefr_sublevel,
    skills: r.skills,
    tags: r.tags,
    license: r.license,
    pluginRowId: r.plugin_id,
    pluginVersionId: r.plugin_version_id,
    packageKey: r.package_key,
    packageSha256: r.package_sha256,
    itemsCount: r.items_count,
    currentVersionId: r.current_version_id,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    moderationNote: r.moderation_note,
    plugin: r.plugins
      ? { pluginId: r.plugins.plugin_id, status: r.plugins.status, disabled: r.plugins.disabled }
      : null,
  };
}

export interface ContentFilters {
  status?: ContentStatus | "all";
  kind?: ContentKind | "all";
  plugin?: string;
  pair?: string;
}

export async function listOwnContent(userId: string, filters: ContentFilters = {}): Promise<ContentRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("content_items")
    .select(COLUMNS)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.plugin) query = query.eq("plugin_id", filters.plugin);
  if (filters.pair) {
    const [source, target] = filters.pair.split(":");
    if (source && target) query = query.eq("source_lang", source).eq("target_lang", target);
  }
  const { data, error } = await query;
  if (error) throw new Error(`content: ${error.message}`);
  return data.map((r) => toRow(r as unknown as Record_));
}

export async function getContentItem(id: string): Promise<ContentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("content_items").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`content item: ${error.message}`);
  return data ? toRow(data as unknown as Record_) : null;
}

export interface ContentVersionRow {
  id: string;
  versionNumber: number;
  packageKey: string;
  packageSha256: string;
  itemsCount: number;
  changeNote: string | null;
  createdAt: string;
}

export async function listContentVersions(itemId: string): Promise<ContentVersionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_versions")
    .select("id, version_number, package_key, package_sha256, items_count, change_note, created_at")
    .eq("item_id", itemId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`content versions: ${error.message}`);
  return data.map((v) => ({
    id: v.id,
    versionNumber: v.version_number,
    packageKey: v.package_key,
    packageSha256: v.package_sha256,
    itemsCount: v.items_count,
    changeNote: v.change_note,
    createdAt: v.created_at,
  }));
}

export async function getContentVersion(itemId: string, versionId: string): Promise<ContentVersionRow | null> {
  const versions = await listContentVersions(itemId);
  return versions.find((v) => v.id === versionId) ?? null;
}

export interface CourseLessonRow {
  lessonId: string;
  position: number;
  title: string;
  translations: ContentTranslations;
  status: ContentStatus;
  pluginId: string | null;
  itemsCount: number;
}

export async function listCourseLessons(courseId: string): Promise<CourseLessonRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_lessons")
    .select(
      "lesson_id, position, content_items!course_lessons_lesson_id_fkey(title, translations, status, items_count, plugins(plugin_id))",
    )
    .eq("course_id", courseId)
    .order("position");
  if (error) throw new Error(`course lessons: ${error.message}`);
  return data.map((row) => {
    const lesson = row.content_items;
    return {
      lessonId: row.lesson_id,
      position: row.position,
      title: lesson.title,
      translations: (lesson.translations && typeof lesson.translations === "object"
        ? lesson.translations
        : {}) as ContentTranslations,
      status: lesson.status,
      pluginId: lesson.plugins?.plugin_id ?? null,
      itemsCount: lesson.items_count,
    };
  });
}

/** Names of languages for the codes used by the member's content, to label pairs. */
export async function languageNames(codes: readonly string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("languages")
    .select("code, name_en")
    .in("code", [...new Set(codes)]);
  if (error) throw new Error(`languages: ${error.message}`);
  return new Map(data.map((l) => [l.code, l.name_en]));
}

export async function countOwnContent(
  userId: string,
): Promise<{ packages: number; courses: number; published: number }> {
  const supabase = await createSupabaseServerClient();
  const head = { count: "exact" as const, head: true };
  const [packages, courses, published] = await Promise.all([
    supabase.from("content_items").select("id", head).eq("owner_id", userId).eq("kind", "package"),
    supabase.from("content_items").select("id", head).eq("owner_id", userId).eq("kind", "course"),
    supabase.from("content_items").select("id", head).eq("owner_id", userId).eq("status", "published"),
  ]);
  for (const r of [packages, courses, published]) if (r.error) throw new Error(`content counts: ${r.error.message}`);
  return { packages: packages.count ?? 0, courses: courses.count ?? 0, published: published.count ?? 0 };
}
