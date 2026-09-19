import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupportRequestKind, SupportRequestStatus } from "@/modules/support/requests";

/**
 * Reads for the administration area. Row level security already limits every
 * table to staff; these helpers only shape the data for the pages.
 */

export interface AdminOverview {
  openRequests: number;
  openReports: number;
  openConductReports: number;
  newFeedback: number;
  members: number;
  creators: number;
  pendingPluginRequests: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createSupabaseServerClient();
  const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await query;
    if (error) throw new Error(`admin overview: ${error.message}`);
    return n ?? 0;
  };
  const [openRequests, openReports, openConductReports, newFeedback, members, creators, pendingPluginRequests] =
    await Promise.all([
      count(
        supabase
          .from("support_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_review"]),
      ),
      count(supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["open", "escalated"])),
      count(
        supabase
          .from("conduct_reports")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "escalated"]),
      ),
      count(supabase.from("product_feedback").select("id", { count: "exact", head: true }).eq("status", "new")),
      count(supabase.from("profiles").select("id", { count: "exact", head: true })),
      count(
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("primary_role", "content_creator"),
      ),
      count(
        supabase.from("plugin_publish_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ),
    ]);
  return { openRequests, openReports, openConductReports, newFeedback, members, creators, pendingPluginRequests };
}

export interface SupportRequestRow {
  id: string;
  kind: SupportRequestKind;
  status: SupportRequestStatus;
  message: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; username: string; displayName: string; primaryRole: string };
  handledBy: string | null;
}

export async function listSupportRequests(scope: "pending" | "closed"): Promise<SupportRequestRow[]> {
  const supabase = await createSupabaseServerClient();
  const base = supabase
    .from("support_requests")
    .select("id, kind, status, message, resolution_note, created_at, resolved_at, user_id, handled_by")
    .order("created_at", { ascending: scope === "pending" });
  const { data, error } =
    scope === "pending"
      ? await base.in("status", ["open", "in_review"])
      : await base.in("status", ["resolved", "rejected"]).limit(100);
  if (error) throw new Error(`support requests: ${error.message}`);
  if (data.length === 0) return [];

  const ids = [...new Set(data.flatMap((r) => [r.user_id, r.handled_by].filter((v): v is string => Boolean(v))))];
  const profiles = await supabase.from("profiles").select("id, username, display_name, primary_role").in("id", ids);
  if (profiles.error) throw new Error(`profiles: ${profiles.error.message}`);
  const byId = new Map(profiles.data.map((p) => [p.id, p]));

  return data.map((r) => {
    const user = byId.get(r.user_id);
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      message: r.message,
      resolutionNote: r.resolution_note,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      user: {
        id: r.user_id,
        username: user?.username ?? "?",
        displayName: user?.display_name ?? "?",
        primaryRole: user?.primary_role ?? "student",
      },
      handledBy: r.handled_by ? (byId.get(r.handled_by)?.username ?? null) : null,
    };
  });
}

export interface ReportRow {
  id: string;
  type: string;
  status: string;
  message: string | null;
  createdAt: string;
  itemTitle: string;
  reporter: string;
}

export async function listContentReports(): Promise<ReportRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, report_type, status, message, created_at, item_id, reporter_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`reports: ${error.message}`);
  if (data.length === 0) return [];
  const [items, reporters] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, title")
      .in("id", [...new Set(data.map((r) => r.item_id))]),
    supabase
      .from("profile_cards")
      .select("id, username")
      .in("id", [...new Set(data.map((r) => r.reporter_id))]),
  ]);
  const titles = new Map((items.data ?? []).map((i) => [i.id, i.title]));
  const names = new Map((reporters.data ?? []).map((p) => [p.id ?? "", p.username ?? "?"]));
  return data.map((r) => ({
    id: r.id,
    type: r.report_type,
    status: r.status,
    message: r.message,
    createdAt: r.created_at,
    itemTitle: titles.get(r.item_id) ?? "?",
    reporter: names.get(r.reporter_id) ?? "?",
  }));
}

export interface ConductReportRow {
  id: string;
  context: string;
  status: string;
  message: string;
  createdAt: string;
  reporter: string;
  reported: string;
}

export async function listConductReports(): Promise<ConductReportRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conduct_reports")
    .select("id, context, status, message, created_at, reporter_id, reported_user_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`conduct reports: ${error.message}`);
  if (data.length === 0) return [];
  const ids = [...new Set(data.flatMap((r) => [r.reporter_id, r.reported_user_id]))];
  const people = await supabase.from("profile_cards").select("id, username").in("id", ids);
  const names = new Map((people.data ?? []).map((p) => [p.id ?? "", p.username ?? "?"]));
  return data.map((r) => ({
    id: r.id,
    context: r.context,
    status: r.status,
    message: r.message,
    createdAt: r.created_at,
    reporter: names.get(r.reporter_id) ?? "?",
    reported: names.get(r.reported_user_id) ?? "?",
  }));
}

export interface FeedbackRow {
  id: string;
  score: number | null;
  category: string;
  message: string | null;
  status: string;
  pagePath: string | null;
  createdAt: string;
  author: string;
}

export async function listProductFeedback(): Promise<FeedbackRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_feedback")
    .select("id, score, category, message, status, page_path, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`product feedback: ${error.message}`);
  if (data.length === 0) return [];
  const people = await supabase
    .from("profile_cards")
    .select("id, username")
    .in("id", [...new Set(data.map((r) => r.user_id))]);
  const names = new Map((people.data ?? []).map((p) => [p.id ?? "", p.username ?? "?"]));
  return data.map((r) => ({
    id: r.id,
    score: r.score,
    category: r.category,
    message: r.message,
    status: r.status,
    pagePath: r.page_path,
    createdAt: r.created_at,
    author: names.get(r.user_id) ?? "?",
  }));
}

export interface MemberRow {
  id: string;
  username: string;
  displayName: string;
  primaryRole: "student" | "content_creator" | "contributor";
  adminRank: "moderator" | "administrator" | "super_administrator" | "platform_owner" | null;
  visibility: string;
  isFoundingMember: boolean;
  createdAt: string;
}

export async function listMembers(search: string): Promise<MemberRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("profiles")
    .select("id, username, display_name, primary_role, visibility, is_founding_member, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const needle = search.trim().replace(/[%_,()]/g, "");
  if (needle) query = query.or(`username.ilike.%${needle}%,display_name.ilike.%${needle}%`);
  const { data, error } = await query;
  if (error) throw new Error(`members: ${error.message}`);
  if (data.length === 0) return [];
  const ranks = await supabase
    .from("admin_ranks")
    .select("user_id, rank")
    .in(
      "user_id",
      data.map((p) => p.id),
    );
  const rankById = new Map((ranks.data ?? []).map((r) => [r.user_id, r.rank]));
  return data.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    primaryRole: p.primary_role,
    adminRank: rankById.get(p.id) ?? null,
    visibility: p.visibility,
    isFoundingMember: p.is_founding_member,
    createdAt: p.created_at,
  }));
}

export interface SettingRow {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export async function listPlatformSettings(): Promise<SettingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value, description, updated_at")
    .order("key");
  if (error) throw new Error(`settings: ${error.message}`);
  return data.map((s) => ({
    key: s.key,
    value: JSON.stringify(s.value),
    description: s.description,
    updatedAt: s.updated_at,
  }));
}

export interface FeatureFlagRow {
  key: string;
  mode: "enabled" | "create_disabled" | "read_only" | "disabled";
  updatedAt: string;
}

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("feature_flags").select("key, mode, updated_at").order("key");
  if (error) throw new Error(`feature flags: ${error.message}`);
  return data.map((f) => ({ key: f.key, mode: f.mode, updatedAt: f.updated_at }));
}

export interface AdminStats {
  members: {
    total: number;
    students: number;
    creators: number;
    contributors: number;
    founding: number;
    newLast7Days: number;
    byRank: Record<"moderator" | "administrator" | "super_administrator" | "platform_owner", number>;
  };
  work: {
    openRequests: number;
    inReviewRequests: number;
    contentReports: number;
    conductReports: number;
    newFeedback: number;
    pluginRequests: number;
  };
  content: { published: number; drafts: number; hidden: number };
  plugins: { published: number; pending: number; disabled: number };
  system: { flags: Array<{ key: string; mode: string }>; settings: number };
}

/** Everything the overview shows, each number in its section. */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createSupabaseServerClient();
  const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await query;
    if (error) throw new Error(`admin stats: ${error.message}`);
    return n ?? 0;
  };
  const head = { count: "exact" as const, head: true };
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [
    total,
    students,
    creators,
    founding,
    newLast7Days,
    ranks,
    openRequests,
    inReviewRequests,
    contentReports,
    conductReports,
    newFeedback,
    published,
    drafts,
    hidden,
    flags,
    settings,
    pluginRequests,
    pluginsPublished,
    pluginsPending,
    pluginsDisabled,
    contributors,
  ] = await Promise.all([
    count(supabase.from("profiles").select("id", head)),
    count(supabase.from("profiles").select("id", head).eq("primary_role", "student")),
    count(supabase.from("profiles").select("id", head).eq("primary_role", "content_creator")),
    count(supabase.from("profiles").select("id", head).eq("is_founding_member", true)),
    count(supabase.from("profiles").select("id", head).gte("created_at", weekAgo)),
    supabase.from("admin_ranks").select("rank"),
    count(supabase.from("support_requests").select("id", head).eq("status", "open")),
    count(supabase.from("support_requests").select("id", head).eq("status", "in_review")),
    count(supabase.from("reports").select("id", head).in("status", ["open", "escalated", "acknowledged"])),
    count(supabase.from("conduct_reports").select("id", head).in("status", ["open", "escalated", "acknowledged"])),
    count(supabase.from("product_feedback").select("id", head).eq("status", "new")),
    count(supabase.from("content_items").select("id", head).eq("status", "published")),
    count(supabase.from("content_items").select("id", head).eq("status", "draft")),
    count(supabase.from("content_items").select("id", head).in("status", ["hidden", "removed"])),
    supabase.from("feature_flags").select("key, mode").order("key"),
    count(supabase.from("platform_settings").select("key", head)),
    count(supabase.from("plugin_publish_requests").select("id", head).eq("status", "pending")),
    count(supabase.from("plugins").select("id", head).eq("status", "published")),
    count(supabase.from("plugins").select("id", head).eq("status", "pending_review")),
    count(supabase.from("plugins").select("id", head).eq("disabled", true)),
    count(supabase.from("profiles").select("id", head).eq("primary_role", "contributor")),
  ]);
  const byRank = { moderator: 0, administrator: 0, super_administrator: 0, platform_owner: 0 };
  for (const row of ranks.data ?? []) byRank[row.rank] += 1;
  return {
    members: { total, students, creators, contributors, founding, newLast7Days, byRank },
    work: { openRequests, inReviewRequests, contentReports, conductReports, newFeedback, pluginRequests },
    content: { published, drafts, hidden },
    plugins: { published: pluginsPublished, pending: pluginsPending, disabled: pluginsDisabled },
    system: { flags: (flags.data ?? []).map((f) => ({ key: f.key, mode: f.mode })), settings },
  };
}
