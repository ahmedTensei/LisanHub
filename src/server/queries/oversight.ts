import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContentTranslations } from "@/modules/content/package-input";
import type { ContentKind, ContentRow, ContentStatus } from "./content";
import { getContentItem, listContentVersions, listCourseLessons, type ContentVersionRow } from "./content";
import type { MemberRow } from "./admin";

/**
 * Reads for the oversight pages of the administration area (decision R17):
 * the Platform Owner and Super Administrators search members, content and
 * plugins, open any of them with a preview, and act on it. Row level security
 * already lets moderation read drafts and restricted profiles; these helpers
 * only shape and search. Nothing here lists "everything" by default: a page
 * shows results for a search or a filter, or the most recent few.
 */

export interface ContentSearch {
  q?: string;
  status?: ContentStatus | "";
  kind?: "package" | "course" | "";
  ownerId?: string;
  pluginRowId?: string;
  limit?: number;
}

export interface ContentSearchRow {
  id: string;
  kind: ContentKind;
  title: string;
  translations: ContentTranslations;
  status: ContentStatus;
  sourceLang: string;
  targetLang: string;
  itemsCount: number;
  updatedAt: string;
  publishedAt: string | null;
  owner: { id: string; username: string; displayName: string } | null;
  pluginId: string | null;
  moderationNote: string | null;
}

function translationsOf(value: unknown): ContentTranslations {
  return (value && typeof value === "object" ? value : {}) as ContentTranslations;
}

export async function searchContent(search: ContentSearch): Promise<ContentSearchRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("content_items")
    .select(
      "id, kind, title, translations, status, source_lang, target_lang, items_count, updated_at, published_at, owner_id, moderation_note, plugins(plugin_id)",
    )
    .in("kind", ["package", "course"])
    .order("updated_at", { ascending: false })
    .limit(Math.min(search.limit ?? 50, 200));
  const needle = (search.q ?? "")
    .trim()
    .replace(/[%_,()]/g, "")
    .slice(0, 80);
  if (needle) query = query.or(`title.ilike.%${needle}%,summary.ilike.%${needle}%`);
  if (search.status) query = query.eq("status", search.status);
  if (search.kind) query = query.eq("kind", search.kind);
  if (search.ownerId) query = query.eq("owner_id", search.ownerId);
  if (search.pluginRowId) query = query.eq("plugin_id", search.pluginRowId);
  const { data, error } = await query;
  if (error) throw new Error(`content search: ${error.message}`);
  if (data.length === 0) return [];

  const ownerIds = [...new Set(data.map((r) => r.owner_id))];
  const owners = await supabase.from("profile_cards").select("id, username, display_name").in("id", ownerIds);
  if (owners.error) throw new Error(`owners: ${owners.error.message}`);
  const ownerById = new Map(
    (owners.data ?? []).map((o) => [
      o.id,
      { id: o.id as string, username: o.username ?? "", displayName: o.display_name ?? "" },
    ]),
  );
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    translations: translationsOf(r.translations),
    status: r.status,
    sourceLang: r.source_lang,
    targetLang: r.target_lang,
    itemsCount: r.items_count,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
    owner: ownerById.get(r.owner_id) ?? null,
    pluginId: r.plugins?.plugin_id ?? null,
    moderationNote: r.moderation_note,
  }));
}

/** One link of the derivation chain, from the item up to its root (decision Q on lineage, S4 shows more). */
export interface LineageLink {
  itemId: string;
  title: string;
  ownerUsername: string | null;
  versionNumber: number | null;
}

export interface ContentOversight {
  item: ContentRow;
  owner: { id: string; username: string; displayName: string } | null;
  moderation: { note: string | null; at: string | null; byUsername: string | null };
  versions: ContentVersionRow[];
  lessons: Awaited<ReturnType<typeof listCourseLessons>>;
  /** Courses this package is part of. */
  courses: { id: string; title: string; translations: ContentTranslations }[];
  /** Upward chain when the item derives from another one: nearest source first. */
  lineage: LineageLink[];
}

export async function getContentOversight(id: string): Promise<ContentOversight | null> {
  const item = await getContentItem(id);
  if (!item) return null;
  const supabase = await createSupabaseServerClient();
  const [raw, versions, lessons, courses] = await Promise.all([
    supabase
      .from("content_items")
      .select("moderation_note, moderated_at, moderated_by, derived_from_version_id")
      .eq("id", id)
      .single(),
    listContentVersions(id),
    item.kind === "course" ? listCourseLessons(id) : Promise.resolve([]),
    item.kind === "package"
      ? supabase
          .from("course_lessons")
          .select("content_items!course_lessons_course_id_fkey(id, title, translations)")
          .eq("lesson_id", id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (raw.error) throw new Error(`content: ${raw.error.message}`);
  if (courses.error) throw new Error(`courses: ${courses.error.message}`);

  const profileIds = [item.ownerId, raw.data.moderated_by].filter((v): v is string => Boolean(v));
  const cards = await supabase.from("profile_cards").select("id, username, display_name").in("id", profileIds);
  const cardById = new Map((cards.data ?? []).map((c) => [c.id as string, c]));
  const ownerCard = cardById.get(item.ownerId);
  const moderatorCard = raw.data.moderated_by ? cardById.get(raw.data.moderated_by) : undefined;

  // Derivation chain: content_versions.id -> item -> its derived_from_version_id, up to the root.
  const lineage: LineageLink[] = [];
  let versionId: string | null = raw.data.derived_from_version_id;
  const seen = new Set<string>();
  while (versionId && !seen.has(versionId) && lineage.length < 20) {
    seen.add(versionId);
    const source: {
      data: {
        item_id: string;
        version_number: number;
        content_items: { title: string; owner_id: string; derived_from_version_id: string | null } | null;
      } | null;
    } = await supabase
      .from("content_versions")
      .select(
        "item_id, version_number, content_items!content_versions_item_id_fkey(title, owner_id, derived_from_version_id)",
      )
      .eq("id", versionId)
      .maybeSingle();
    if (!source.data || !source.data.content_items) break;
    const ownerCardOfSource = await supabase
      .from("profile_cards")
      .select("username")
      .eq("id", source.data.content_items.owner_id)
      .maybeSingle();
    lineage.push({
      itemId: source.data.item_id,
      title: source.data.content_items.title,
      ownerUsername: ownerCardOfSource.data?.username ?? null,
      versionNumber: source.data.version_number,
    });
    versionId = source.data.content_items.derived_from_version_id;
  }

  return {
    item,
    owner: ownerCard
      ? { id: ownerCard.id as string, username: ownerCard.username ?? "", displayName: ownerCard.display_name ?? "" }
      : null,
    moderation: {
      note: raw.data.moderation_note,
      at: raw.data.moderated_at,
      byUsername: moderatorCard?.username ?? null,
    },
    versions,
    lessons,
    courses: (courses.data ?? [])
      .map((row) => row.content_items)
      .filter((c) => c !== null)
      .map((c) => ({ id: c.id, title: c.title, translations: translationsOf(c.translations) })),
    lineage,
  };
}

export interface MemberOversight {
  member: MemberRow & { bio: string | null; location: string | null; uiLocale: string };
  content: ContentSearchRow[];
  plugins: { id: string; pluginId: string; status: string; disabled: boolean; updatedAt: string }[];
  supportRequests: { id: string; kind: string; status: string; createdAt: string }[];
}

/** Everything the administration needs about one member: account state, their content, plugins and requests. */
export async function getMemberOversight(username: string): Promise<MemberOversight | null> {
  const supabase = await createSupabaseServerClient();
  const profile = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, primary_role, visibility, is_founding_member, created_at, bio, location, ui_locale",
    )
    .ilike("username", username.replace(/[%_]/g, ""))
    .maybeSingle();
  if (profile.error) throw new Error(`profile: ${profile.error.message}`);
  if (!profile.data) return null;
  const p = profile.data;
  const [rank, content, plugins, requests] = await Promise.all([
    supabase.from("admin_ranks").select("rank").eq("user_id", p.id).maybeSingle(),
    searchContent({ ownerId: p.id, limit: 100 }),
    supabase
      .from("plugins")
      .select("id, plugin_id, status, disabled, updated_at")
      .eq("owner_id", p.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("support_requests")
      .select("id, kind, status, created_at")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (plugins.error) throw new Error(`plugins: ${plugins.error.message}`);
  if (requests.error) throw new Error(`support requests: ${requests.error.message}`);
  return {
    member: {
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      primaryRole: p.primary_role,
      adminRank: rank.data?.rank ?? null,
      visibility: p.visibility,
      isFoundingMember: p.is_founding_member,
      createdAt: p.created_at,
      bio: p.bio,
      location: p.location,
      uiLocale: p.ui_locale,
    },
    content,
    plugins: plugins.data.map((row) => ({
      id: row.id,
      pluginId: row.plugin_id,
      status: row.status,
      disabled: row.disabled,
      updatedAt: row.updated_at,
    })),
    supportRequests: requests.data.map((r) => ({ id: r.id, kind: r.kind, status: r.status, createdAt: r.created_at })),
  };
}
