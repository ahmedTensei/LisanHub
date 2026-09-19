import { describe, expect, it } from "vitest";
import { can, capabilitiesOf } from "./capabilities";
import {
  canAccessAdminArea,
  canModerateContent,
  canOverseeAll,
  canAssignRank,
  canAccessStudio,
  canBecomeContentCreator,
  canBecomeContributor,
  canDisablePlugin,
  canEditPlugin,
  canReviewPlugin,
  publishesDirectly,
  canCopy,
  canCreateContent,
  canDecideSupportRequest,
  canEdit,
  canEditPlatformSettings,
  canHide,
  canView,
  type ContentRef,
} from "./policies";
import { allowedRoleTransitions, emulate, guest, toActor, type Actor } from "./roles";

const student: Actor = { kind: "user", userId: "s", primaryRole: "student", adminRank: null };
const creator: Actor = { kind: "user", userId: "c", primaryRole: "content_creator", adminRank: null };
const otherCreator: Actor = { kind: "user", userId: "o", primaryRole: "content_creator", adminRank: null };
const moderator: Actor = { kind: "user", userId: "m", primaryRole: "student", adminRank: "moderator" };
const owner: Actor = { kind: "user", userId: "p", primaryRole: "student", adminRank: "platform_owner" };

const published: ContentRef = { ownerId: "c", status: "published", isPaid: false };
const draft: ContentRef = { ownerId: "c", status: "draft", isPaid: false };
const paid: ContentRef = { ownerId: "c", status: "published", isPaid: true };

describe("capabilities", () => {
  it("lets guests browse only", () => {
    expect([...capabilitiesOf(guest)]).toEqual(["content.browse_public"]);
  });

  it("never lets a Student publish", () => {
    expect(can(student, "content.create")).toBe(false);
    expect(can(student, "content.derive_publish")).toBe(false);
    expect(canCreateContent(student)).toEqual({ allowed: false, reason: "content_creator_role_required" });
  });

  it("gives higher administrative ranks every lower-rank capability", () => {
    expect(can(owner, "moderation.hide_content")).toBe(true);
    expect(can(owner, "admin.platform_settings")).toBe(true);
    expect(can(moderator, "admin.platform_settings")).toBe(false);
  });

  it("lets a Student choose Content Creator or Contributor, with no self-service way back", () => {
    expect(allowedRoleTransitions("student")).toEqual(["content_creator", "contributor"]);
    expect(allowedRoleTransitions("content_creator")).toEqual([]);
    expect(allowedRoleTransitions("contributor")).toEqual([]);
  });
});

describe("ownership policies", () => {
  it("lets owners edit and blocks other creators", () => {
    expect(canEdit(creator, published).allowed).toBe(true);
    expect(canEdit(otherCreator, published)).toEqual({ allowed: false, reason: "not_owner" });
  });

  it("lets moderation edit anyone's content and hide it", () => {
    expect(canEdit(moderator, published).allowed).toBe(true);
    expect(canHide(moderator).allowed).toBe(true);
    expect(canHide(creator).allowed).toBe(false);
  });

  it("keeps drafts private to owner and moderation", () => {
    expect(canView(guest, draft).allowed).toBe(false);
    expect(canView(creator, draft).allowed).toBe(true);
    expect(canView(moderator, draft).allowed).toBe(true);
  });
});

describe("copy and derivation", () => {
  it("allows a Student a local personal copy but not a published derivation", () => {
    expect(canCopy(student, published, "local_personal_copy").allowed).toBe(true);
    expect(canCopy(student, published, "published_derivation")).toEqual({
      allowed: false,
      reason: "content_creator_role_required",
    });
  });

  it("allows a Content Creator to publish a derivation of free content", () => {
    expect(canCopy(otherCreator, published, "published_derivation").allowed).toBe(true);
  });

  it("protects paid content from every kind of copy", () => {
    expect(canCopy(student, paid, "local_personal_copy")).toEqual({ allowed: false, reason: "paid_content_protected" });
    expect(canCopy(otherCreator, paid, "published_derivation").allowed).toBe(false);
  });
});

describe("actor resolution", () => {
  it("maps stored records to an actor and treats a missing record as a guest", () => {
    expect(toActor(null)).toEqual(guest);
    expect(toActor({ userId: "u", primaryRole: "student" })).toEqual({
      kind: "user",
      userId: "u",
      primaryRole: "student",
      adminRank: null,
    });
    expect(toActor({ userId: "u", primaryRole: "content_creator", adminRank: "administrator" })).toMatchObject({
      adminRank: "administrator",
    });
  });

  it("refuses corrupt records instead of downgrading silently", () => {
    expect(() => toActor({ userId: "u", primaryRole: "teacher" })).toThrow(/unknown primary role/);
    expect(() => toActor({ userId: "u", primaryRole: "student", adminRank: "root" })).toThrow(/unknown admin rank/);
  });
});

describe("role change", () => {
  it("lets a Student become a Content Creator, once, and nobody else", () => {
    expect(canBecomeContentCreator(student).allowed).toBe(true);
    expect(canBecomeContentCreator(creator)).toEqual({ allowed: false, reason: "already_content_creator" });
    expect(canBecomeContentCreator(guest)).toEqual({ allowed: false, reason: "sign_in_required" });
    const contributor: Actor = { kind: "user", userId: "x", primaryRole: "contributor", adminRank: null };
    expect(canBecomeContentCreator(contributor)).toEqual({ allowed: false, reason: "role_change_not_allowed" });
  });

  it("opens the Contributor path to Students only, one path per member (decision R10)", () => {
    const contributor: Actor = { kind: "user", userId: "x", primaryRole: "contributor", adminRank: null };
    expect(canBecomeContributor(student).allowed).toBe(true);
    expect(canBecomeContributor(creator)).toEqual({ allowed: false, reason: "role_change_not_allowed" });
    expect(canBecomeContributor(contributor)).toEqual({ allowed: false, reason: "already_contributor" });
    expect(canBecomeContributor(guest)).toEqual({ allowed: false, reason: "sign_in_required" });
  });

  it("grants every signed-in user their own profile and language pairs", () => {
    expect(can(student, "profile.edit_own")).toBe(true);
    expect(can(student, "language_pairs.manage_own")).toBe(true);
    expect(can(guest, "profile.edit_own")).toBe(false);
  });
});

describe("platform owner", () => {
  it("holds every capability whatever the primary role", () => {
    expect(can(owner, "content.create")).toBe(true);
    expect(can(owner, "plugins.publish")).toBe(true);
    expect(capabilitiesOf(owner).size).toBeGreaterThan(capabilitiesOf(moderator).size);
  });

  it("can view the platform as a narrower rank or role, nobody else can", () => {
    expect(emulate(owner, "moderator")).toEqual({ ...owner, adminRank: "moderator" });
    expect(emulate(owner, "student")).toEqual({ ...owner, primaryRole: "student", adminRank: null });
    expect(can(emulate(owner, "moderator"), "admin.manage_users")).toBe(false);
    expect(can(emulate(owner, "content_creator"), "content.create")).toBe(true);
    expect(emulate(moderator, "administrator")).toEqual(moderator);
    expect(emulate(owner, null)).toEqual(owner);
  });
});

describe("platform owner", () => {
  it("holds every capability whatever the primary role", () => {
    expect(can(owner, "content.create")).toBe(true);
    expect(can(owner, "plugins.publish")).toBe(true);
    expect(capabilitiesOf(owner).size).toBeGreaterThan(capabilitiesOf(moderator).size);
  });

  it("can view the platform as a narrower rank or role, nobody else can", () => {
    expect(emulate(owner, "moderator")).toEqual({ ...owner, adminRank: "moderator" });
    expect(emulate(owner, "student")).toEqual({ ...owner, primaryRole: "student", adminRank: null });
    expect(can(emulate(owner, "moderator"), "admin.manage_users")).toBe(false);
    expect(can(emulate(owner, "content_creator"), "content.create")).toBe(true);
    expect(emulate(moderator, "administrator")).toEqual(moderator);
    expect(emulate(owner, null)).toEqual(owner);
  });
});

describe("platform owner", () => {
  it("holds every capability whatever the primary role", () => {
    expect(can(owner, "content.create")).toBe(true);
    expect(can(owner, "plugins.publish")).toBe(true);
    expect(capabilitiesOf(owner).size).toBeGreaterThan(capabilitiesOf(moderator).size);
  });

  it("can view the platform as a narrower rank or role, nobody else can", () => {
    expect(emulate(owner, "moderator")).toEqual({ ...owner, adminRank: "moderator" });
    expect(emulate(owner, "student")).toEqual({ ...owner, primaryRole: "student", adminRank: null });
    expect(can(emulate(owner, "moderator"), "admin.manage_users")).toBe(false);
    expect(can(emulate(owner, "content_creator"), "content.create")).toBe(true);
    expect(emulate(moderator, "administrator")).toEqual(moderator);
    expect(emulate(owner, null)).toEqual(owner);
  });
});

describe("administration area", () => {
  const admin: Actor = { kind: "user", userId: "a", primaryRole: "student", adminRank: "administrator" };
  const superAdmin: Actor = { kind: "user", userId: "sa", primaryRole: "student", adminRank: "super_administrator" };

  it("opens only to administrative ranks", () => {
    expect(canAccessAdminArea(student)).toEqual({ allowed: false, reason: "staff_only" });
    expect(canAccessAdminArea(moderator).allowed).toBe(true);
  });

  it("lets moderators review requests but only administrators return a member to Student", () => {
    expect(canDecideSupportRequest(moderator, "revert_to_student", "in_review").allowed).toBe(true);
    expect(canDecideSupportRequest(moderator, "revert_to_student", "resolved")).toEqual({
      allowed: false,
      reason: "administrator_required",
    });
    expect(canDecideSupportRequest(admin, "revert_to_student", "resolved").allowed).toBe(true);
    expect(canDecideSupportRequest(student, "other", "rejected").allowed).toBe(false);
  });

  it("assigns ranks by level, with the owner above everyone", () => {
    const nobody = { userId: "x", adminRank: null };
    expect(canAssignRank(admin, nobody, "moderator")).toEqual({
      allowed: false,
      reason: "super_administrator_required",
    });
    expect(canAssignRank(superAdmin, nobody, "moderator").allowed).toBe(true);
    expect(canAssignRank(superAdmin, nobody, "super_administrator")).toEqual({ allowed: false, reason: "owner_only" });
    expect(canAssignRank(superAdmin, { userId: "o", adminRank: "platform_owner" }, null)).toEqual({
      allowed: false,
      reason: "owner_only",
    });
    expect(canAssignRank(superAdmin, { userId: "sa", adminRank: "super_administrator" }, null)).toEqual({
      allowed: false,
      reason: "own_rank",
    });
    expect(canAssignRank(owner, nobody, "super_administrator").allowed).toBe(true);
    expect(canEditPlatformSettings(moderator).allowed).toBe(false);
    expect(canEditPlatformSettings(admin).allowed).toBe(true);
  });

  it("lets the owner and super administrators oversee everything; lower ranks moderate what reaches them (decision R17)", () => {
    expect(canOverseeAll(owner).allowed).toBe(true);
    expect(canOverseeAll(superAdmin).allowed).toBe(true);
    expect(canOverseeAll(admin)).toEqual({ allowed: false, reason: "super_administrator_required" });
    expect(canOverseeAll(moderator).allowed).toBe(false);
    expect(canOverseeAll(creator).allowed).toBe(false);
    expect(canModerateContent(moderator).allowed).toBe(true);
    expect(canModerateContent(creator)).toEqual({ allowed: false, reason: "moderation_only" });
  });
});

describe("plugin studio (decisions R7 and R10)", () => {
  const contributor: Actor = { kind: "user", userId: "c1", primaryRole: "contributor", adminRank: null };
  const other: Actor = { kind: "user", userId: "c2", primaryRole: "contributor", adminRank: null };
  const moderator: Actor = { kind: "user", userId: "m", primaryRole: "student", adminRank: "moderator" };
  const owner: Actor = { kind: "user", userId: "o", primaryRole: "student", adminRank: "platform_owner" };
  const draft = { ownerId: "c1", status: "draft" as const, disabled: false };

  it("admits Contributors and the owner, never Students or Content Creators", () => {
    expect(canAccessStudio(contributor).allowed).toBe(true);
    expect(canAccessStudio(owner).allowed).toBe(true);
    expect(canAccessStudio(student)).toEqual({ allowed: false, reason: "contributor_role_required" });
    expect(canAccessStudio(creator).allowed).toBe(false);
    expect(canAccessStudio(moderator).allowed).toBe(false);
    expect(canAccessStudio(guest).allowed).toBe(false);
  });

  it("lets a Contributor edit only their own plugin, and nobody a disabled one", () => {
    expect(canEditPlugin(contributor, draft).allowed).toBe(true);
    expect(canEditPlugin(other, draft)).toEqual({ allowed: false, reason: "not_owner" });
    expect(canEditPlugin(contributor, { ...draft, disabled: true })).toEqual({
      allowed: false,
      reason: "plugin_disabled",
    });
    expect(canEditPlugin(owner, { ...draft, ownerId: null }).allowed).toBe(true);
    expect(canEditPlugin(contributor, { ...draft, ownerId: null })).toEqual({ allowed: false, reason: "not_owner" });
  });

  it("publishes directly only with plugins.publish; review and kill switch stay with moderation", () => {
    expect(publishesDirectly(contributor)).toBe(false);
    expect(publishesDirectly(owner)).toBe(true);
    expect(canReviewPlugin(contributor)).toEqual({ allowed: false, reason: "moderation_only" });
    expect(canReviewPlugin(moderator).allowed).toBe(true);
    expect(canDisablePlugin(moderator).allowed).toBe(true);
    expect(canDisablePlugin(contributor).allowed).toBe(false);
  });
});
