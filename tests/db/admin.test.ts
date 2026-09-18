import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createMigratedDb, createUser, type Db } from "./harness";

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

    const created = await asUser(db, owner, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title)
         values ('lesson', $1, 'arq', 'fra', 'Owner lesson') returning id`,
        [owner],
      ),
    );
    expect(created.rows).toHaveLength(1);
    await expect(
      asUser(db, student, () =>
        db.query(
          `insert into public.content_items (kind, owner_id, source_lang, target_lang, title)
           values ('lesson', $1, 'arq', 'fra', 'Not allowed')`,
          [student],
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
