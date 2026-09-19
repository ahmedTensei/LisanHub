import { beforeAll, describe, expect, it } from "vitest";
import {
  asAnon,
  asUser,
  createMigratedDb,
  createReferencePlugin,
  createUser,
  PACKAGE_SHA,
  packageKey,
  type Db,
} from "./harness";

/**
 * Support requests and the administration functions (decision R4 and the
 * administration area): who may read, decide and assign ranks.
 */
describe("support requests and administration", () => {
  let db: Db;
  let member: string;
  let other: string;
  let moderator: string;
  let admin: string;
  let superAdmin: string;
  let owner: string;

  const grant = (userId: string, rank: string) =>
    db.query("insert into public.admin_ranks (user_id, rank) values ($1, $2)", [userId, rank]);

  beforeAll(async () => {
    db = await createMigratedDb();
    member = await createUser(db, "member_1");
    other = await createUser(db, "other_1");
    moderator = await createUser(db, "mod_1");
    admin = await createUser(db, "admin_1");
    superAdmin = await createUser(db, "super_1");
    owner = await createUser(db, "owner_1");
    await grant(moderator, "moderator");
    await grant(admin, "administrator");
    await grant(superAdmin, "super_administrator");
    await grant(owner, "platform_owner");
    await asUser(db, member, () => db.query("select public.become_content_creator()"));
  });

  it("lets a member open one pending request of a kind, readable by staff only", async () => {
    await asUser(db, member, () =>
      db.query(
        "insert into public.support_requests (user_id, kind, message) values ($1, 'revert_to_student', 'Please')",
        [member],
      ),
    );
    await expect(
      asUser(db, member, () =>
        db.query("insert into public.support_requests (user_id, kind) values ($1, 'revert_to_student')", [member]),
      ),
    ).rejects.toThrow(/support_requests_one_pending_idx/);
    await expect(
      asUser(db, other, () =>
        db.query("insert into public.support_requests (user_id, kind) values ($1, 'other')", [member]),
      ),
    ).rejects.toThrow(/row-level security/);

    const seenBy = async (userId: string) =>
      (await asUser(db, userId, () => db.query("select id from public.support_requests"))).rows.length;
    expect(await seenBy(member)).toBe(1);
    expect(await seenBy(other)).toBe(0);
    expect(await seenBy(moderator)).toBe(1);

    await expect(
      asUser(db, member, () =>
        db.query("update public.support_requests set status = 'resolved' where user_id = $1", [member]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("returns a member to Student only when an Administrator resolves the request", async () => {
    const request = await db.query<{ id: string }>("select id from public.support_requests where user_id = $1", [
      member,
    ]);
    const id = request.rows[0].id;

    await expect(
      asAnon(db, () => db.query("select public.resolve_support_request($1, 'resolved')", [id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, other, () => db.query("select public.resolve_support_request($1, 'resolved')", [id])),
    ).rejects.toThrow(/moderator rank required/);

    // A moderator can review it but cannot execute a role change.
    await asUser(db, moderator, () => db.query("select public.resolve_support_request($1, 'in_review')", [id]));
    await expect(
      asUser(db, moderator, () => db.query("select public.resolve_support_request($1, 'resolved', 'ok')", [id])),
    ).rejects.toThrow(/administrator rank required/);

    await asUser(db, admin, () => db.query("select public.resolve_support_request($1, 'resolved', 'Reviewed')", [id]));
    const after = await db.query<{ status: string; handled_by: string; primary_role: string }>(
      `select r.status, r.handled_by, p.primary_role from public.support_requests r
         join public.profiles p on p.id = r.user_id where r.id = $1`,
      [id],
    );
    expect(after.rows[0]).toEqual({ status: "resolved", handled_by: admin, primary_role: "student" });

    const notified = await asUser(db, member, () =>
      db.query("select kind from public.notifications where user_id = $1", [member]),
    );
    expect(notified.rows.map((r) => (r as { kind: string }).kind)).toContain("support.request_resolved");

    await expect(
      asUser(db, admin, () => db.query("select public.resolve_support_request($1, 'rejected')", [id])),
    ).rejects.toThrow(/already closed/);
  });

  it("assigns administrative ranks by rank: super administrators below themselves, the owner anyone", async () => {
    await expect(
      asUser(db, admin, () => db.query("select public.admin_set_rank($1, 'moderator')", [other])),
    ).rejects.toThrow(/super administrator rank required/);

    await asUser(db, superAdmin, () => db.query("select public.admin_set_rank($1, 'moderator')", [other]));
    const rank = await db.query<{ rank: string; granted_by: string }>(
      "select rank, granted_by from public.admin_ranks where user_id = $1",
      [other],
    );
    expect(rank.rows[0]).toEqual({ rank: "moderator", granted_by: superAdmin });

    await expect(
      asUser(db, superAdmin, () => db.query("select public.admin_set_rank($1, 'super_administrator')", [other])),
    ).rejects.toThrow(/only the platform owner/);
    await expect(
      asUser(db, superAdmin, () => db.query("select public.admin_set_rank($1, null)", [owner])),
    ).rejects.toThrow(/only the platform owner/);
    await expect(
      asUser(db, superAdmin, () => db.query("select public.admin_set_rank($1, null)", [superAdmin])),
    ).rejects.toThrow(/your own rank/);

    await asUser(db, owner, () => db.query("select public.admin_set_rank($1, 'super_administrator')", [other]));
    await asUser(db, owner, () => db.query("select public.admin_set_rank($1, null)", [other]));
    const removed = await db.query("select 1 from public.admin_ranks where user_id = $1", [other]);
    expect(removed.rows).toHaveLength(0);

    const audited = await db.query<{ count: number }>(
      "select count(*)::int as count from public.audit_log where target_table = 'admin_ranks' and target_id = $1",
      [other],
    );
    expect(audited.rows[0].count).toBeGreaterThanOrEqual(3);
  });

  it("lets moderation hide published content with a reason and restore it, keeping the file (decision R17)", async () => {
    const plugin = await createReferencePlugin(db, "moderation-plugin");
    const author = await createUser(db, "moderated_author");
    await asUser(db, author, () => db.query("select public.become_content_creator()"));
    const item = await asUser(db, author, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id, package_key, package_sha256)
         values ('package', $1, 'ara', 'fra', 'Moderated pack', $2, $3, $4) returning id`,
        [author, plugin, packageKey(author, "draft-moderated"), PACKAGE_SHA],
      ),
    );
    const itemId = item.rows[0].id;
    const version = await asUser(db, author, () =>
      db.query<{ id: string }>(
        "insert into public.content_versions (item_id, package_key, package_sha256, items_count) values ($1, $2, $3, 1) returning id",
        [itemId, packageKey(author, itemId + "-v1"), PACKAGE_SHA],
      ),
    );
    await asUser(db, author, () =>
      db.query("update public.content_items set status = 'published', current_version_id = $2 where id = $1", [
        itemId,
        version.rows[0].id,
      ]),
    );

    const moderate = (who: string, hide: boolean, note: string | null) =>
      asUser(db, who, () => db.query("select public.moderate_content_item($1, $2, $3)", [itemId, hide, note]));
    await expect(moderate(other, true, "spam")).rejects.toThrow(/moderation only/);
    await expect(moderate(moderator, true, "  ")).rejects.toThrow(/reason is required/);
    await moderate(moderator, true, "Copied from a textbook");

    const hidden = await db.query<{
      status: string;
      moderation_note: string;
      package_key: string;
      current_version_id: string;
    }>("select status, moderation_note, package_key, current_version_id from public.content_items where id = $1", [
      itemId,
    ]);
    expect(hidden.rows[0]).toMatchObject({
      status: "hidden",
      moderation_note: "Copied from a textbook",
      package_key: packageKey(author, "draft-moderated"),
      current_version_id: version.rows[0].id,
    });
    // The owner still reads the reason; other members no longer see the item.
    const ownerView = await asUser(db, author, () =>
      db.query<{ moderation_note: string }>("select moderation_note from public.content_items where id = $1", [itemId]),
    );
    expect(ownerView.rows[0].moderation_note).toBe("Copied from a textbook");
    const otherView = await asUser(db, other, () =>
      db.query("select id from public.content_items where id = $1", [itemId]),
    );
    expect(otherView.rows).toHaveLength(0);

    await expect(moderate(moderator, true, "again")).rejects.toThrow(/only published content can be hidden/);
    await moderate(moderator, false, null);
    const restored = await db.query<{ status: string; moderation_note: string | null }>(
      "select status, moderation_note from public.content_items where id = $1",
      [itemId],
    );
    expect(restored.rows[0]).toEqual({ status: "published", moderation_note: null });
    const audit = await db.query<{ n: string }>(
      "select count(*)::text as n from public.audit_log where target_table = 'content_items' and target_id = $1 and action = 'update'",
      [itemId],
    );
    expect(Number(audit.rows[0].n)).toBeGreaterThanOrEqual(3);
  });

  it("lets moderation triage platform feedback", async () => {
    const inserted = await asUser(db, other, () =>
      db.query<{ id: string }>(
        "insert into public.product_feedback (user_id, score, category, message) values ($1, 5, 'idea', 'Audio') returning id",
        [other],
      ),
    );
    const id = inserted.rows[0].id;
    const byAuthor = await asUser(db, other, () =>
      db.query("update public.product_feedback set status = 'done' where id = $1", [id]),
    );
    expect(byAuthor.affectedRows).toBe(0);
    const triaged = await asUser(db, moderator, () =>
      db.query("update public.product_feedback set status = 'reviewed' where id = $1", [id]),
    );
    expect(triaged.affectedRows).toBe(1);
  });
});

describe("platform owner and profile details", () => {
  it("lets the Platform Owner create community content without the Content Creator role", async () => {
    const db = await createMigratedDb();
    const owner = await createUser(db, "owner_2");
    const student = await createUser(db, "student_2");
    await db.query("insert into public.admin_ranks (user_id, rank) values ($1, 'platform_owner')", [owner]);
    const plugin = await createReferencePlugin(db);

    const created = await asUser(db, owner, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id)
         values ('package', $1, 'arq', 'fra', 'Owner lesson', $2) returning id`,
        [owner, plugin],
      ),
    );
    expect(created.rows).toHaveLength(1);
    await expect(
      asUser(db, student, () =>
        db.query(
          `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id)
           values ('package', $1, 'arq', 'fra', 'Not allowed', $2)`,
          [student, plugin],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("stores a profile picture as a relative object key inside the member's own folder", async () => {
    const db = await createMigratedDb();
    const member = await createUser(db, "pic_user");
    const ok = await asUser(db, member, () =>
      db.query(
        "update public.profiles set avatar_key = $2, bio = 'Learner from Oran', location = 'Oran' where id = $1",
        [member, `avatars/${member}/9b1e.webp`],
      ),
    );
    expect(ok.affectedRows).toBe(1);
    await expect(
      asUser(db, member, () =>
        db.query("update public.profiles set avatar_key = $2 where id = $1", [member, "https://cdn.example/a.webp"]),
      ),
    ).rejects.toThrow(/profiles_avatar_key_check/);
    const card = await asAnon(db, () =>
      db.query<{ avatar_key: string }>("select avatar_key from public.profile_cards where id = $1", [member]),
    );
    expect(card.rows[0].avatar_key).toBe(`avatars/${member}/9b1e.webp`);
  });
});
