import { adminLevel, type Actor } from "./roles";

export const CAPABILITIES = [
  "content.browse_public",
  "content.study",
  "content.copy_local",
  "content.create",
  "content.derive_publish",
  "content.report",
  "content.feedback",
  "content.rate",
  "chat.participate",
  "profile.edit_own",
  "language_pairs.manage_own",
  "plugins.author",
  "plugins.publish",
  "plugins.review",
  "plugins.disable",
  "moderation.edit_any_content",
  "moderation.hide_content",
  "moderation.handle_queue",
  "admin.manage_users",
  "admin.approve_roles",
  "admin.platform_settings",
  "admin.oversee_all",
  "super_admin.manage_administrators",
  "owner.platform_core",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const SIGNED_IN: Capability[] = [
  "content.browse_public",
  "content.study",
  "content.copy_local",
  "content.report",
  "content.feedback",
  "content.rate",
  "chat.participate",
  "profile.edit_own",
  "language_pairs.manage_own",
];

const BY_PRIMARY_ROLE = {
  student: [],
  content_creator: ["content.create", "content.derive_publish"],
  contributor: ["plugins.author"],
} as const satisfies Record<string, readonly Capability[]>;

const BY_ADMIN_LEVEL: Record<number, Capability[]> = {
  1: [
    "moderation.edit_any_content",
    "moderation.hide_content",
    "moderation.handle_queue",
    "plugins.review",
    "plugins.disable",
  ],
  2: ["admin.manage_users", "admin.approve_roles", "admin.platform_settings"],
  // admin.oversee_all: the owner and the rank right below act as deputies and see everything (decision R17);
  // lower ranks reach content, plugins and members through the cases assigned to or accepted by them (S4).
  3: ["super_admin.manage_administrators", "admin.oversee_all"],
  // plugins.publish: direct publication (decision R10) — the owner in phase A, verified Contributors later.
  4: ["owner.platform_core", "plugins.publish", "plugins.author"],
};

/**
 * Resolves every capability an actor holds. Feature code checks capabilities,
 * never role names. The Platform Owner is never limited (decision R6): every
 * capability, whatever the primary role.
 */
export function capabilitiesOf(actor: Actor): ReadonlySet<Capability> {
  if (actor.kind === "guest") return new Set<Capability>(["content.browse_public"]);
  if (actor.adminRank === "platform_owner") return new Set<Capability>(CAPABILITIES);

  const granted = new Set<Capability>([...SIGNED_IN, ...BY_PRIMARY_ROLE[actor.primaryRole]]);
  const level = adminLevel(actor.adminRank);
  for (let l = 1; l <= level; l++) {
    for (const capability of BY_ADMIN_LEVEL[l]) granted.add(capability);
  }
  return granted;
}

export function can(actor: Actor, capability: Capability): boolean {
  return capabilitiesOf(actor).has(capability);
}
