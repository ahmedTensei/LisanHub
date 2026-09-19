import { can } from "./capabilities";
import { adminLevel, allowedRoleTransitions, type Actor, type AdminRank } from "./roles";

export type ContentStatus = "draft" | "published" | "archived" | "hidden" | "removed";

export interface ContentRef {
  ownerId: string;
  status: ContentStatus;
  isPaid: boolean;
}

export type Decision = { allowed: true } | { allowed: false; reason: string };

const allow: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });

function isOwner(actor: Actor, content: ContentRef): boolean {
  return actor.kind === "user" && actor.userId === content.ownerId;
}

export function canView(actor: Actor, content: ContentRef): Decision {
  if (content.status === "published" || content.status === "archived") return allow;
  if (isOwner(actor, content) || can(actor, "moderation.edit_any_content")) return allow;
  return deny("content_not_visible");
}

/** Owners edit their own content; only the four administrative ranks edit anyone's. */
export function canEdit(actor: Actor, content: ContentRef): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  if (can(actor, "moderation.edit_any_content")) return allow;
  if (!isOwner(actor, content)) return deny("not_owner");
  if (content.status === "hidden" || content.status === "removed") return deny("under_moderation");
  return allow;
}

export function canHide(actor: Actor): Decision {
  return can(actor, "moderation.hide_content") ? allow : deny("moderation_only");
}

export function canCreateContent(actor: Actor): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  return can(actor, "content.create") ? allow : deny("content_creator_role_required");
}

export type CopyMode = "local_personal_copy" | "published_derivation";

/**
 * Two distinct operations with different rules (ugc-content-system, content-lineage):
 * - a local personal copy stays on the user's device, never indexed, never shared;
 * - a published derivation is public, attributed and requires the Content Creator role.
 */
export function canCopy(actor: Actor, source: ContentRef, mode: CopyMode): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  if (source.isPaid) return deny("paid_content_protected");
  if (source.status !== "published") return deny("source_not_published");

  if (mode === "local_personal_copy") {
    return can(actor, "content.copy_local") ? allow : deny("not_allowed");
  }
  return can(actor, "content.derive_publish") ? allow : deny("content_creator_role_required");
}

/**
 * Role changes a member chooses for themselves: Student -> Content Creator (R4)
 * or Student -> Contributor (R10). One path only; the way back goes through support.
 */
export function canBecomeContentCreator(actor: Actor): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  if (actor.primaryRole === "content_creator") return deny("already_content_creator");
  return allowedRoleTransitions(actor.primaryRole).includes("content_creator")
    ? allow
    : deny("role_change_not_allowed");
}

export function canBecomeContributor(actor: Actor): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  if (actor.primaryRole === "contributor") return deny("already_contributor");
  return allowedRoleTransitions(actor.primaryRole).includes("contributor") ? allow : deny("role_change_not_allowed");
}

// ---------------------------------------------------------------------------
// Plugin Studio and plugin moderation (decisions R7 and R10; mirrors migration 20260918000100)
// ---------------------------------------------------------------------------

export interface PluginRef {
  /** Null for the platform's own reference plugins. */
  ownerId: string | null;
  status: "draft" | "pending_review" | "published" | "hidden";
  disabled: boolean;
}

/** Entering the studio: Contributors and the Platform Owner (never Students or Content Creators). */
export function canAccessStudio(actor: Actor): Decision {
  return can(actor, "plugins.author") ? allow : deny("contributor_role_required");
}

/** Building, previewing and exporting: only the owner of the plugin; the platform's plugins belong to the owner rank. */
export function canEditPlugin(actor: Actor, plugin: PluginRef): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  if (!can(actor, "plugins.author")) return deny("contributor_role_required");
  if (plugin.disabled) return deny("plugin_disabled");
  if (plugin.ownerId === null) return can(actor, "owner.platform_core") ? allow : deny("not_owner");
  return plugin.ownerId === actor.userId ? allow : deny("not_owner");
}

/** Submitting a version: the owner of the plugin; it is published at once only with plugins.publish. */
export function canSubmitPlugin(actor: Actor, plugin: PluginRef): Decision {
  const edit = canEditPlugin(actor, plugin);
  if (!edit.allowed) return edit;
  return allow;
}

export function publishesDirectly(actor: Actor): boolean {
  return can(actor, "plugins.publish");
}

/** Approving or rejecting a publish request: moderation. */
export function canReviewPlugin(actor: Actor): Decision {
  return can(actor, "plugins.review") ? allow : deny("moderation_only");
}

/** Kill switch and hiding: moderation and the owner of the platform. */
export function canDisablePlugin(actor: Actor): Decision {
  return can(actor, "plugins.disable") ? allow : deny("moderation_only");
}

// ---------------------------------------------------------------------------
// Administration area (mirrors the database functions of migration 0900)
// ---------------------------------------------------------------------------

/** Entering the administration area: any administrative rank. */
/**
 * Decision R17: the Platform Owner and Super Administrators oversee everything —
 * every item, plugin and member, with previews — from the administration area.
 * Moderators and Administrators see only what is assigned to them or what they
 * accepted (cases, S4), so they never wander through all the content.
 */
export function canOverseeAll(actor: Actor): Decision {
  return can(actor, "admin.oversee_all") ? allow : deny("super_administrator_required");
}

export function canModerateContent(actor: Actor): Decision {
  return can(actor, "moderation.hide_content") ? allow : deny("moderation_only");
}

export function canAccessAdminArea(actor: Actor): Decision {
  return can(actor, "moderation.handle_queue") ? allow : deny("staff_only");
}

/** Deciding a support request; executing a return to Student needs Administrator rank. */
export function canDecideSupportRequest(
  actor: Actor,
  kind: "revert_to_student" | "other",
  decision: "in_review" | "resolved" | "rejected",
): Decision {
  if (!can(actor, "moderation.handle_queue")) return deny("staff_only");
  if (kind === "revert_to_student" && decision === "resolved" && !can(actor, "admin.approve_roles")) {
    return deny("administrator_required");
  }
  return allow;
}

/** Changing a member's primary role from the administration area (Administrator rank). */
export function canSetPrimaryRoleAsAdmin(actor: Actor): Decision {
  return can(actor, "admin.approve_roles") ? allow : deny("administrator_required");
}

/**
 * Assigning administrative ranks: Super Administrators below their own level,
 * the Platform Owner anyone. Nobody changes their own rank.
 */
export function canAssignRank(
  actor: Actor,
  target: { userId: string; adminRank: AdminRank | null },
  next: AdminRank | null,
): Decision {
  if (!can(actor, "super_admin.manage_administrators")) return deny("super_administrator_required");
  if (actor.kind !== "user") return deny("sign_in_required");
  if (target.userId === actor.userId) return deny("own_rank");
  const callerLevel = adminLevel(actor.adminRank);
  if (callerLevel < 4 && (adminLevel(target.adminRank) >= callerLevel || adminLevel(next) >= callerLevel)) {
    return deny("owner_only");
  }
  return allow;
}

/** Platform settings and feature switches: Administrator rank. */
export function canEditPlatformSettings(actor: Actor): Decision {
  return can(actor, "admin.platform_settings") ? allow : deny("administrator_required");
}
