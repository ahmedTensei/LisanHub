import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LocaleText } from "@/modules/plugins/fields";
import { loadDefinition, loadDraft } from "@/server/plugins/store";

/** Reads for the plugin moderation page of the administration area (decision R10). */

export interface PublishRequestRow {
  id: string;
  pluginRowId: string;
  pluginId: string;
  version: string;
  status: "pending" | "approved" | "rejected";
  name: LocaleText | null;
  activities: number;
  templates: number;
  changeNote: string | null;
  decisionReason: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: { id: string; username: string; displayName: string };
}

export async function listPublishRequests(scope: "pending" | "decided"): Promise<PublishRequestRow[]> {
  const supabase = await createSupabaseServerClient();
  const base = supabase
    .from("plugin_publish_requests")
    .select(
      "id, plugin_id, requested_by, version, definition_key, definition_sha256, change_note, status, decision_reason, decision_note, created_at, decided_at, plugins!inner(plugin_id)",
    )
    .order("created_at", { ascending: scope === "pending" });
  const { data, error } =
    scope === "pending" ? await base.eq("status", "pending") : await base.neq("status", "pending").limit(50);
  if (error) throw new Error(`publish requests: ${error.message}`);
  if (data.length === 0) return [];

  const ids = [...new Set(data.map((r) => r.requested_by))];
  const profiles = await supabase.from("profile_cards").select("id, username, display_name").in("id", ids);
  if (profiles.error) throw new Error(`profiles: ${profiles.error.message}`);
  const byId = new Map(profiles.data.map((p) => [p.id, p]));

  // The snapshot under review is a file (decision R13), read and verified against the request's hash.
  const snapshots = await Promise.all(data.map((r) => loadDefinition(r.definition_key, r.definition_sha256)));
  return data.map((r, index) => {
    const definition = snapshots[index];
    const who = byId.get(r.requested_by);
    return {
      id: r.id,
      pluginRowId: r.plugin_id,
      pluginId: r.plugins.plugin_id,
      version: r.version,
      status: r.status,
      name: definition?.name ?? null,
      activities: definition?.activities.length ?? 0,
      templates: definition?.templates.length ?? 0,
      changeNote: r.change_note,
      decisionReason: r.decision_reason,
      decisionNote: r.decision_note,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
      requestedBy: { id: r.requested_by, username: who?.username ?? "…", displayName: who?.display_name ?? "…" },
    };
  });
}

export interface AdminPluginRow {
  id: string;
  pluginId: string;
  status: "draft" | "pending_review" | "published" | "hidden";
  disabled: boolean;
  disabledMessage: Record<string, string>;
  ownerId: string | null;
  ownerUsername: string | null;
  currentVersion: { id: string; version: string; disabled: boolean } | null;
  versions: { id: string; version: string; disabled: boolean }[];
  name: LocaleText | null;
}

/** Every plugin that reached the catalogue (or is waiting for it), with its versions and kill-switch state. */
export async function listAdminPlugins(): Promise<AdminPluginRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugins")
    .select(
      "id, plugin_id, status, disabled, disabled_message, owner_id, current_version_id, draft_key, draft_sha256, plugin_versions!plugin_versions_plugin_id_fkey(id, version, version_number, definition_key, definition_sha256, disabled)",
    )
    .in("status", ["pending_review", "published", "hidden"])
    .order("plugin_id");
  if (error) throw new Error(`admin plugins: ${error.message}`);

  const ownerIds = [...new Set(data.map((p) => p.owner_id).filter((v): v is string => Boolean(v)))];
  const profiles = ownerIds.length
    ? await supabase.from("profile_cards").select("id, username").in("id", ownerIds)
    : { data: [], error: null };
  if (profiles.error) throw new Error(`profiles: ${profiles.error.message}`);
  const usernames = new Map((profiles.data ?? []).map((p) => [p.id, p.username]));

  // Names come from the current version's file, or from the draft file while nothing is published yet.
  const names = await Promise.all(
    data.map(async (p): Promise<LocaleText | null> => {
      const current = p.plugin_versions.find((v) => v.id === p.current_version_id);
      if (current) return (await loadDefinition(current.definition_key, current.definition_sha256))?.name ?? null;
      if (p.draft_key && p.draft_sha256) {
        const name = (await loadDraft(p.draft_key, p.draft_sha256))?.name;
        return name ? { ar: name.ar ?? "", fr: name.fr ?? "", en: name.en ?? "" } : null;
      }
      return null;
    }),
  );
  return data.map((p, index) => {
    const versions = [...p.plugin_versions].sort((a, b) => b.version_number - a.version_number);
    const current = versions.find((v) => v.id === p.current_version_id) ?? null;
    return {
      id: p.id,
      pluginId: p.plugin_id,
      status: p.status,
      disabled: p.disabled,
      disabledMessage: (p.disabled_message ?? {}) as Record<string, string>,
      ownerId: p.owner_id,
      ownerUsername: p.owner_id ? (usernames.get(p.owner_id) ?? null) : null,
      currentVersion: current ? { id: current.id, version: current.version, disabled: current.disabled } : null,
      versions: versions.map((v) => ({ id: v.id, version: v.version, disabled: v.disabled })),
      name: names[index],
    };
  });
}

export async function countPendingPublishRequests(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("plugin_publish_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`publish requests: ${error.message}`);
  return count ?? 0;
}
