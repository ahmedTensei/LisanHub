import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Actor } from "@/modules/authorization/roles";
import { PluginDraft, type PluginDraft as Draft } from "@/modules/plugins/contract";
import { definitionFromDraft, type DefinitionValidation } from "@/modules/plugins/generate";
import type { PluginLimits } from "@/modules/platform/settings";
import { loadDraft } from "@/server/plugins/store";

/**
 * Reads for the Plugin Studio (decision R10). Row level security already
 * limits drafts to their owner and moderation; the draft itself is a file in
 * the store named by the row (decision R13), read and verified here.
 */

export type PluginStatus = "draft" | "pending_review" | "published" | "hidden";

export interface StudioPluginRow {
  id: string;
  pluginId: string;
  ownerId: string | null;
  status: PluginStatus;
  disabled: boolean;
  disabledMessage: Record<string, string>;
  draft: Draft;
  /** Key and hash of the draft file; null before the first save (the row then carries a bare draft). */
  draftKey: string | null;
  draftSha256: string | null;
  currentVersionId: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface StudioVersionRow {
  id: string;
  version: string;
  versionNumber: number;
  sha256: string;
  disabled: boolean;
  createdAt: string;
  changeNote: string | null;
}

export interface StudioRequestRow {
  id: string;
  version: string;
  status: "pending" | "approved" | "rejected";
  decisionReason: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** A stored draft is what the studio wrote; anything else degrades to the bare identifier. */
export function draftOf(pluginId: string, stored: unknown): Draft {
  const parsed = PluginDraft.safeParse(
    typeof stored === "object" && stored ? { plugin_id: pluginId, ...stored } : { plugin_id: pluginId },
  );
  return parsed.success ? parsed.data : PluginDraft.parse({ plugin_id: pluginId });
}

function messageMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

const PLUGIN_COLUMNS =
  "id, plugin_id, owner_id, status, disabled, disabled_message, draft_key, draft_sha256, current_version_id, published_at, updated_at";

type PluginRecord = {
  id: string;
  plugin_id: string;
  owner_id: string | null;
  status: PluginStatus;
  disabled: boolean;
  disabled_message: unknown;
  draft_key: string | null;
  draft_sha256: string | null;
  current_version_id: string | null;
  published_at: string | null;
  updated_at: string;
};

/** Reads the draft file the row names; a missing or tampered file degrades to the bare identifier. */
async function toRow(record: PluginRecord): Promise<StudioPluginRow> {
  const stored =
    record.draft_key && record.draft_sha256 ? await loadDraft(record.draft_key, record.draft_sha256) : null;
  return {
    id: record.id,
    pluginId: record.plugin_id,
    ownerId: record.owner_id,
    status: record.status,
    disabled: record.disabled,
    disabledMessage: messageMap(record.disabled_message),
    draft: draftOf(record.plugin_id, stored),
    draftKey: record.draft_key,
    draftSha256: record.draft_sha256,
    currentVersionId: record.current_version_id,
    publishedAt: record.published_at,
    updatedAt: record.updated_at,
  };
}

/** The plugins this member builds: their own, plus the platform's for the owner rank. */
export async function listStudioPlugins(actor: Actor): Promise<StudioPluginRow[]> {
  if (actor.kind !== "user") return [];
  const supabase = await createSupabaseServerClient();
  const base = supabase.from("plugins").select(PLUGIN_COLUMNS).order("updated_at", { ascending: false });
  const { data, error } =
    actor.adminRank === "platform_owner"
      ? await base.or(`owner_id.eq.${actor.userId},owner_id.is.null`)
      : await base.eq("owner_id", actor.userId);
  if (error) throw new Error(`studio plugins: ${error.message}`);
  return Promise.all(data.map(toRow));
}

export async function getStudioPlugin(id: string): Promise<StudioPluginRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("plugins").select(PLUGIN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`studio plugin: ${error.message}`);
  return data ? toRow(data) : null;
}

export async function listPluginVersions(pluginRowId: string): Promise<StudioVersionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugin_versions")
    .select("id, version, version_number, definition_sha256, disabled, created_at, change_note")
    .eq("plugin_id", pluginRowId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`plugin versions: ${error.message}`);
  return data.map((v) => ({
    id: v.id,
    version: v.version,
    versionNumber: v.version_number,
    sha256: v.definition_sha256,
    disabled: v.disabled,
    createdAt: v.created_at,
    changeNote: v.change_note,
  }));
}

export async function listPluginRequests(pluginRowId: string): Promise<StudioRequestRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugin_publish_requests")
    .select("id, version, status, decision_reason, decision_note, created_at, decided_at")
    .eq("plugin_id", pluginRowId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(`plugin requests: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    version: r.version,
    status: r.status,
    decisionReason: r.decision_reason,
    decisionNote: r.decision_note,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
  }));
}

/** The draft as a full definition candidate, validated against the contract. */
export function validateStudioDraft(draft: Draft, limits: PluginLimits): DefinitionValidation {
  return definitionFromDraft(draft, limits);
}

/** Suggests the next patch version after the latest published one. */
export function nextVersion(versions: readonly StudioVersionRow[], draftVersion: string): string {
  const latest = versions[0]?.version;
  if (!latest) return draftVersion;
  const [major, minor, patch] = latest.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}
