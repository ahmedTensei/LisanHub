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
 * The only role change of the current stage: Student -> Content Creator, chosen by
 * the user. Contributor is deferred with executable content (mvp-scope).
 */
export function canBecomeContentCreator(actor: Actor): Decision {
  if (actor.kind === "guest") return deny("sign_in_required");
  if (actor.primaryRole === "content_creator") return deny("already_content_creator");
  return allowedRoleTransitions(actor.primaryRole).includes("content_creator")
    ? allow
    : deny("role_change_not_allowed");
}

// ---------------------------------------------------------------------------
// Administration area (mirrors the database functions of migration 0900)
// ---------------------------------------------------------------------------

/** Entering the administration area: any administrative rank. */
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
