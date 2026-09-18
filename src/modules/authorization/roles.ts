/**
 * Role model from the specification (see `.claude/skills/roles-permissions`).
 * Role, capability, ownership, verification, reputation and trust score are
 * independent concepts. Only roles and administrative ranks feed authorization.
 */

export const PRIMARY_ROLES = ["student", "content_creator", "contributor"] as const;
export type PrimaryRole = (typeof PRIMARY_ROLES)[number];

/** Ordered from lowest to highest. */
export const ADMIN_RANKS = ["moderator", "administrator", "super_administrator", "platform_owner"] as const;
export type AdminRank = (typeof ADMIN_RANKS)[number];

/** A guest has no user id and no primary role. */
export type Actor =
  | { kind: "guest" }
  | {
      kind: "user";
      userId: string;
      /** Exactly one primary role; Content Creator and Contributor are mutually exclusive by type. */
      primaryRole: PrimaryRole;
      adminRank: AdminRank | null;
    };

export const guest: Actor = { kind: "guest" };

export function adminLevel(rank: AdminRank | null): number {
  return rank === null ? 0 : ADMIN_RANKS.indexOf(rank) + 1;
}

/** What the Platform Owner may impersonate to try the platform with narrower permissions. */
export const VIEW_AS_OPTIONS = [
  "student",
  "content_creator",
  "moderator",
  "administrator",
  "super_administrator",
] as const;
export type ViewAs = (typeof VIEW_AS_OPTIONS)[number];

export function isViewAs(value: unknown): value is ViewAs {
  return typeof value === "string" && (VIEW_AS_OPTIONS as readonly string[]).includes(value);
}

/**
 * Narrows the owner's actor to the chosen rank or role for the application
 * layer only (policies, navigation). Anyone else keeps their real actor.
 */
export function emulate(actor: Actor, viewAs: ViewAs | null): Actor {
  if (!viewAs || actor.kind !== "user" || actor.adminRank !== "platform_owner") return actor;
  if (viewAs === "student" || viewAs === "content_creator") return { ...actor, primaryRole: viewAs, adminRank: null };
  return { ...actor, adminRank: viewAs };
}

/** Roles a user may switch to in the current stage. Contributor is deferred with executable content. */
export function allowedRoleTransitions(from: PrimaryRole): PrimaryRole[] {
  return from === "student" ? ["content_creator"] : [];
}

/** What the persistence layer knows about a signed-in user (profiles + admin_ranks). */
export interface ActorRecord {
  userId: string;
  primaryRole: string;
  adminRank?: string | null;
}

function isPrimaryRole(value: string): value is PrimaryRole {
  return (PRIMARY_ROLES as readonly string[]).includes(value);
}

function isAdminRank(value: string): value is AdminRank {
  return (ADMIN_RANKS as readonly string[]).includes(value);
}

/**
 * Builds the Actor used by every capability check from stored records.
 * A missing record means a guest; a corrupt one is an error, never a silent downgrade.
 */
export function toActor(record: ActorRecord | null | undefined): Actor {
  if (!record) return guest;
  if (!record.userId) throw new Error("actor: user id required");
  if (!isPrimaryRole(record.primaryRole)) throw new Error(`actor: unknown primary role "${record.primaryRole}"`);
  const rank = record.adminRank ?? null;
  if (rank !== null && !isAdminRank(rank)) throw new Error(`actor: unknown admin rank "${rank}"`);
  return { kind: "user", userId: record.userId, primaryRole: record.primaryRole, adminRank: rank };
}
