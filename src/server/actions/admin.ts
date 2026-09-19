"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/account/forms";
import { isUiLocale, UI_LOCALES } from "@/modules/account/ui-locales";
import {
  canAssignRank,
  canDecideSupportRequest,
  canDisablePlugin,
  canEditPlatformSettings,
  canModerateContent,
  canReviewPlugin,
  canSetPrimaryRoleAsAdmin,
} from "@/modules/authorization/policies";
import { ADMIN_RANKS, type AdminRank } from "@/modules/authorization/roles";
import { isAllowedMode, isFeatureKey, isPlatformSettingKey, parseSettingValue } from "@/modules/platform/settings";
import { SUPPORT_DECISIONS, SUPPORT_REQUEST_KINDS, type SupportDecision } from "@/modules/support/requests";
import { getSession } from "@/server/actor";

/**
 * Staff actions of the administration area. Each one checks the policy in
 * src/modules/authorization first; the database functions enforce the same
 * ranks again and write the audit log.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function localeOf(value: string): string {
  return isUiLocale(value) ? value : "ar";
}

function text(formData: FormData, name: string, max: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

export async function decideSupportRequest(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const id = formData.get("id");
  const kind = formData.get("kind");
  const decision = formData.get("decision");
  if (typeof id !== "string" || !UUID.test(id)) return { status: "error", error: "invalid_input" };
  if (!(SUPPORT_REQUEST_KINDS as readonly string[]).includes(String(kind))) {
    return { status: "error", error: "invalid_input" };
  }
  if (!(SUPPORT_DECISIONS as readonly string[]).includes(String(decision))) {
    return { status: "error", error: "invalid_input" };
  }
  const allowed = canDecideSupportRequest(actor, kind as "revert_to_student" | "other", decision as SupportDecision);
  if (!allowed.allowed) return { status: "error", error: allowed.reason };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_support_request", {
    p_request: id,
    p_status: decision as SupportDecision,
    p_note: text(formData, "note", 2000) ?? undefined,
  });
  if (error)
    return { status: "error", error: error.message.includes("already closed") ? "already_closed" : "unexpected" };

  revalidatePath(`/${uiLocale}/admin`);
  revalidatePath(`/${uiLocale}/admin/requests`);
  return { status: "ok", outcome: decision as string };
}

export async function setMemberRole(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const decision = canSetPrimaryRoleAsAdmin(actor);
  if (!decision.allowed) return { status: "error", error: decision.reason };

  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof userId !== "string" || !UUID.test(userId) || (role !== "student" && role !== "content_creator")) {
    return { status: "error", error: "invalid_input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_primary_role", { p_user: userId, p_role: role });
  if (error) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/admin/users`);
  return { status: "ok", outcome: "role_set" };
}

export async function setMemberRank(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const userId = formData.get("userId");
  const current = formData.get("currentRank");
  const next = formData.get("rank");
  const isRank = (v: unknown): v is AdminRank =>
    typeof v === "string" && (ADMIN_RANKS as readonly string[]).includes(v);
  if (typeof userId !== "string" || !UUID.test(userId)) return { status: "error", error: "invalid_input" };
  if (next !== "" && !isRank(next)) return { status: "error", error: "invalid_input" };
  const currentRank = isRank(current) ? current : null;
  const nextRank = isRank(next) ? next : null;

  const decision = canAssignRank(actor, { userId, adminRank: currentRank }, nextRank);
  if (!decision.allowed) return { status: "error", error: decision.reason };

  const supabase = await createSupabaseServerClient();
  // The function accepts null to remove a rank; the generated type only knows the enum.
  const { error } = await supabase.rpc("admin_set_rank", { p_user: userId, p_rank: nextRank as unknown as AdminRank });
  if (error) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/admin/users`);
  return { status: "ok", outcome: "rank_set" };
}

export async function updatePlatformSetting(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const decision = canEditPlatformSettings(actor);
  if (!decision.allowed) return { status: "error", error: decision.reason };

  const key = formData.get("key");
  const raw = formData.get("value");
  if (!isPlatformSettingKey(key) || typeof raw !== "string") return { status: "error", error: "invalid_input" };
  // Only the catalogue's options are accepted: administration chooses, it never types values.
  const value = parseSettingValue(key, raw);
  if (value === null) return { status: "error", error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase
    .from("platform_settings")
    .update({ value, updated_by: actor.kind === "user" ? actor.userId : null })
    .eq("key", key)
    .select("key");
  if (error || !data?.length) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/admin/settings`);
  return { status: "ok", outcome: "setting_saved" };
}

export async function updateFeatureFlag(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const decision = canEditPlatformSettings(actor);
  if (!decision.allowed) return { status: "error", error: decision.reason };

  const key = formData.get("key");
  const mode = formData.get("mode");
  // Each switch has its own sensible modes (maintenance is on/off, chat can be read-only…).
  if (!isFeatureKey(key) || !isAllowedMode(key, mode)) return { status: "error", error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase
    .from("feature_flags")
    .update({ mode, updated_by: actor.kind === "user" ? actor.userId : null })
    .eq("key", key)
    .select("key");
  if (error || !data?.length) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/admin/settings`);
  return { status: "ok", outcome: "flag_saved" };
}

export async function triageFeedback(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "staff_only" };

  const id = formData.get("id");
  const status = formData.get("status");
  const statuses = ["new", "reviewed", "planned", "done", "dismissed"] as const;
  if (typeof id !== "string" || !UUID.test(id) || !(statuses as readonly string[]).includes(String(status))) {
    return { status: "error", error: "invalid_input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase
    .from("product_feedback")
    .update({ status: status as (typeof statuses)[number] })
    .eq("id", id)
    .select("id");
  if (error) return { status: "error", error: "unexpected" };
  if (!data?.length) return { status: "error", error: "staff_only" };

  revalidatePath(`/${uiLocale}/admin/feedback`);
  return { status: "ok", outcome: "feedback_triaged" };
}

export async function updateReportStatus(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "staff_only" };

  const id = formData.get("id");
  const table = formData.get("table");
  const status = formData.get("status");
  const statuses = ["acknowledged", "resolved", "dismissed", "escalated"] as const;
  if (typeof id !== "string" || !UUID.test(id) || !(statuses as readonly string[]).includes(String(status))) {
    return { status: "error", error: "invalid_input" };
  }
  if (table !== "reports" && table !== "conduct_reports") return { status: "error", error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const next = status as (typeof statuses)[number];
  const closing = next === "resolved" || next === "dismissed";
  const { error, data } =
    table === "reports"
      ? await supabase
          .from("reports")
          .update({
            status: next,
            resolution_note: text(formData, "note", 2000),
            resolved_by: closing ? actor.userId : null,
            resolved_at: closing ? new Date().toISOString() : null,
          })
          .eq("id", id)
          .select("id")
      : await supabase.from("conduct_reports").update({ status: next }).eq("id", id).select("id");
  if (error) return { status: "error", error: "unexpected" };
  if (!data?.length) return { status: "error", error: "staff_only" };

  revalidatePath(`/${uiLocale}/admin/reports`);
  return { status: "ok", outcome: "report_updated" };
}

// ---------------------------------------------------------------------------
// Plugins (decision R10): review publish requests, kill switch, hiding
// ---------------------------------------------------------------------------

const PLUGIN_REJECTION_REASONS = ["contract", "quality", "duplicate", "policy", "other"] as const;

export async function reviewPluginRequest(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const allowed = canReviewPlugin(actor);
  if (!allowed.allowed) return { status: "error", error: allowed.reason };
  const id = formData.get("id");
  const decision = formData.get("decision");
  if (typeof id !== "string" || !UUID.test(id)) return { status: "error", error: "invalid_input" };
  if (decision !== "approve" && decision !== "reject") return { status: "error", error: "invalid_input" };
  const reason = text(formData, "reason", 20);
  if (decision === "reject" && !(PLUGIN_REJECTION_REASONS as readonly string[]).includes(String(reason))) {
    return { status: "error", error: "reason_required" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_plugin_publish_request", {
    p_request: id,
    p_approve: decision === "approve",
    p_reason: decision === "reject" ? (reason ?? undefined) : undefined,
    p_note: text(formData, "note", 1000) ?? undefined,
  });
  if (error) {
    return { status: "error", error: error.message.includes("already decided") ? "already_closed" : "unexpected" };
  }
  revalidatePath(`/${uiLocale}/admin`);
  revalidatePath(`/${uiLocale}/admin/plugins`);
  revalidatePath(`/${uiLocale}/studio`, "layout");
  return { status: "ok", outcome: decision === "approve" ? "plugin_approved" : "plugin_rejected" };
}

export async function setPluginKillSwitch(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const allowed = canDisablePlugin(actor);
  if (!allowed.allowed) return { status: "error", error: allowed.reason };
  const plugin = formData.get("plugin");
  const version = formData.get("version");
  const disabled = formData.get("disabled") === "true";
  if (typeof plugin !== "string" || !UUID.test(plugin)) return { status: "error", error: "invalid_input" };
  if (typeof version === "string" && version !== "" && !UUID.test(version))
    return { status: "error", error: "invalid_input" };
  const note = text(formData, "note", 300);
  const message = note ? Object.fromEntries(UI_LOCALES.map((l) => [l, note])) : {};

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_plugin_disabled", {
    p_plugin: plugin,
    // Null means the whole plugin; the generated type does not know the column is nullable.
    p_version: (typeof version === "string" && version !== "" ? version : null) as unknown as string,
    p_disabled: disabled,
    p_message: message,
  });
  if (error) return { status: "error", error: "unexpected" };
  revalidatePath(`/${uiLocale}/admin/plugins`);
  revalidatePath(`/${uiLocale}/studio`, "layout");
  return { status: "ok", outcome: disabled ? "plugin_disabled" : "plugin_enabled" };
}

export async function setPluginHidden(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const allowed = canDisablePlugin(actor);
  if (!allowed.allowed) return { status: "error", error: allowed.reason };
  const plugin = formData.get("plugin");
  const hidden = formData.get("hidden") === "true";
  if (typeof plugin !== "string" || !UUID.test(plugin)) return { status: "error", error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_plugin_hidden", { p_plugin: plugin, p_hidden: hidden });
  if (error) return { status: "error", error: "unexpected" };
  revalidatePath(`/${uiLocale}/admin/plugins`);
  revalidatePath(`/${uiLocale}/studio`, "layout");
  return { status: "ok", outcome: hidden ? "plugin_hidden" : "plugin_shown" };
}

/**
 * Decision R17: take a published package or course off the community with a
 * written reason, or put a hidden one back. The database function checks the
 * rank again, keeps the reason on the item for its owner and audits the change;
 * the package file and its versions are never touched.
 */
export async function moderateContent(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const allowed = canModerateContent(actor);
  if (!allowed.allowed) return { status: "error", error: allowed.reason };
  const item = formData.get("item");
  const hide = formData.get("hide") === "true";
  if (typeof item !== "string" || !UUID.test(item)) return { status: "error", error: "invalid_input" };
  const note = text(formData, "note", 500);
  if (hide && note === null) return { status: "error", error: "reason_required" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("moderate_content_item", {
    p_item: item,
    p_hide: hide,
    // Null when restoring; the generated type does not know the argument is nullable.
    p_note: note as unknown as string,
  });
  if (error) {
    if (error.code === "23514") return { status: "error", error: "already_closed" };
    return { status: "error", error: "unexpected" };
  }
  revalidatePath(`/${uiLocale}/admin/content`, "layout");
  revalidatePath(`/${uiLocale}/content`, "layout");
  return { status: "ok", outcome: hide ? "content_hidden" : "content_restored" };
}
