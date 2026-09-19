import { beforeAll, describe, expect, it } from "vitest";
import {
  asAnon,
  asUser,
  createMigratedDb,
  createReferencePlugin,
  createUser,
  packageKey,
  PACKAGE_SHA,
  type Db,
} from "./harness";

/**
 * Database-level invariants from the specification, verified against the real
 * migrations with row level security enforced.
 */
describe("database invariants", () => {
  let db: Db;
  let student: string;
  let creatorA: string;
  let creatorB: string;
  let moderator: string;
  let plugin: string;

  async function createPublishedLesson(ownerId: string, title: string, isPaid = false) {
    return asUser(db, ownerId, async () => {
      const item = await db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, status, plugin_id)
         values ('package', $1, 'fra', 'arb', $2, 'draft', $3) returning id`,
        [ownerId, title, plugin],
      );
      const itemId = item.rows[0].id;
      const version = await db.query<{ id: string }>(
        `insert into public.content_versions (item_id, package_key, package_sha256, author_id) values ($1, $2, $3, $4) returning id`,
        [itemId, packageKey(ownerId, itemId), PACKAGE_SHA, ownerId],
      );
      await db.query(`update public.content_items set status = 'published', current_version_id = $2 where id = $1`, [
        itemId,
        version.rows[0].id,
      ]);
      if (isPaid) {
        // Platform-side change (no signed-in user): paid status is never set by the owner in the MVP.
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub', '', false)");
        await db.query("update public.content_items set is_paid = true where id = $1", [itemId]);
      }
      return { itemId, versionId: version.rows[0].id };
    });
  }

  beforeAll(async () => {
    db = await createMigratedDb();
    student = await createUser(db, "student1");
    creatorA = await createUser(db, "creator_a");
    creatorB = await createUser(db, "creator_b");
    moderator = await createUser(db, "moderator");
    plugin = await createReferencePlugin(db);
    for (const id of [creatorA, creatorB]) {
      await asUser(db, id, () => db.query("select public.become_content_creator()"));
    }
    await db.query("insert into public.admin_ranks (user_id, rank) values ($1, 'moderator')", [moderator]);
  });

  it("gives every new account a Student profile", async () => {
    const res = await db.query<{ primary_role: string }>("select primary_role from public.profiles where id = $1", [
      student,
    ]);
    expect(res.rows[0].primary_role).toBe("student");
  });

  it("loads the ISO 639-3 language table", async () => {
    const res = await db.query<{ count: number }>("select count(*)::int as count from public.languages");
    expect(res.rows[0].count).toBeGreaterThan(7000);
  });

  it("prevents a Student from creating community content", async () => {
    await expect(
      asUser(db, student, () =>
        db.query(
          `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id)
           values ('package', $1, 'fra', 'arb', 'Not allowed', $2)`,
          [student, plugin],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("prevents users from changing their own primary role directly", async () => {
    await expect(
      asUser(db, student, () =>
        db.query("update public.profiles set primary_role = 'content_creator' where id = $1", [student]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets a Content Creator publish, and anonymous visitors read only published content", async () => {
    const { itemId } = await createPublishedLesson(creatorA, "Greetings");
    const draft = await asUser(db, creatorA, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id)
         values ('package', $1, 'fra', 'arb', 'Draft', $2) returning id`,
        [creatorA, plugin],
      ),
    );

    const visible = await asAnon(db, () =>
      db.query<{ id: string }>("select id from public.content_items where id = any($1)", [[itemId, draft.rows[0].id]]),
    );
    expect(visible.rows.map((r) => r.id)).toEqual([itemId]);
  });

  it("prevents editing content owned by someone else", async () => {
    const { itemId } = await createPublishedLesson(creatorA, "Numbers");
    const res = await asUser(db, creatorB, () =>
      db.query("update public.content_items set title = 'Hijacked' where id = $1", [itemId]),
    );
    expect(res.affectedRows).toBe(0);
  });

  it("keeps content history append-only", async () => {
    const { versionId } = await createPublishedLesson(creatorA, "Colours");
    await expect(
      asUser(db, creatorA, () =>
        db.query("update public.content_versions set package_sha256 = $2 where id = $1", [versionId, "d".repeat(64)]),
      ),
    ).rejects.toThrow(/permission denied|append-only/);
  });

  it("records provenance when deriving free content, even across language pairs", async () => {
    const { itemId, versionId } = await createPublishedLesson(creatorA, "Family");
    const derived = await asUser(db, creatorB, () =>
      db.query<{ root_item_id: string; provenance: { source_item_id: string } }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, derived_from_version_id, plugin_id)
         values ('package', $1, 'eng', 'arb', 'Family (English)', $2, $3) returning root_item_id, provenance`,
        [creatorB, versionId, plugin],
      ),
    );
    expect(derived.rows[0].root_item_id).toBe(itemId);
    expect(derived.rows[0].provenance.source_item_id).toBe(itemId);
  });

  it("refuses to derive paid content", async () => {
    const { versionId } = await createPublishedLesson(creatorA, "Premium", true);
    await expect(
      asUser(db, creatorB, () =>
        db.query(
          `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, derived_from_version_id, plugin_id)
           values ('package', $1, 'fra', 'arb', 'Copy', $2, $3)`,
          [creatorB, versionId, plugin],
        ),
      ),
    ).rejects.toThrow(/paid content cannot be copied/);
  });

  it("stores learning progress for a Student without any subscription", async () => {
    const { itemId } = await createPublishedLesson(creatorA, "Food");
    await asUser(db, student, () =>
      db.query("insert into public.progress (user_id, item_id, state) values ($1, $2, 'completed')", [student, itemId]),
    );
    const others = await asUser(db, creatorB, () =>
      db.query("select 1 from public.progress where user_id = $1", [student]),
    );
    expect(others.rows).toHaveLength(0);
  });

  it("collects platform feedback privately, readable by the author and moderation only", async () => {
    await asUser(db, student, () =>
      db.query(
        "insert into public.product_feedback (user_id, score, category, message) values ($1, 4, 'idea', 'More audio')",
        [student],
      ),
    );
    const own = await asUser(db, student, () =>
      db.query("select 1 from public.product_feedback where user_id = $1", [student]),
    );
    const other = await asUser(db, creatorB, () =>
      db.query("select 1 from public.product_feedback where user_id = $1", [student]),
    );
    const staff = await asUser(db, moderator, () =>
      db.query("select 1 from public.product_feedback where user_id = $1", [student]),
    );
    expect([own.rows.length, other.rows.length, staff.rows.length]).toEqual([1, 0, 1]);
  });

  it("has no subscription, payment or entitlement tables before the final stage", async () => {
    const res = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public'
          and table_name ~ '(entitlement|subscription|payment|payout|purchase|order|heavy_content)'`,
    );
    expect(res.rows).toEqual([]);
  });

  it("escalates repeated open reports to moderation", async () => {
    const { itemId } = await createPublishedLesson(creatorA, "Weather");
    for (const reporter of [student, creatorB, moderator]) {
      await asUser(db, reporter, () =>
        db.query("insert into public.reports (item_id, reporter_id, report_type) values ($1, $2, 'error')", [
          itemId,
          reporter,
        ]),
      );
    }
    const res = await db.query<{ status: string }>("select distinct status from public.reports where item_id = $1", [
      itemId,
    ]);
    expect(res.rows.map((r) => r.status)).toEqual(["escalated"]);
  });

  it("reserves hiding content for moderation", async () => {
    const { itemId } = await createPublishedLesson(creatorA, "Travel");
    await expect(
      asUser(db, creatorA, () => db.query("update public.content_items set status = 'hidden' where id = $1", [itemId])),
    ).rejects.toThrow(/only moderation/);

    const res = await asUser(db, moderator, () =>
      db.query("update public.content_items set status = 'hidden' where id = $1", [itemId]),
    );
    expect(res.affectedRows).toBe(1);
  });

  it("does not let an owner award their own quality label", async () => {
    const { itemId } = await createPublishedLesson(creatorA, "Sports");
    await expect(
      asUser(db, creatorA, () =>
        db.query("update public.content_items set quality_label = 'founding_team_reviewed' where id = $1", [itemId]),
      ),
    ).rejects.toThrow(/not editable by the owner/);
  });

  it("writes an audit record for content changes", async () => {
    const res = await db.query<{ count: number }>(
      "select count(*)::int as count from public.audit_log where target_table = 'content_items'",
    );
    expect(res.rows[0].count).toBeGreaterThan(0);
  });
});

describe("schema conventions", () => {
  it("stores relative object keys, never storage urls (ADR 0005)", async () => {
    const db = await createMigratedDb();
    const res = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and (column_name = 'url' or column_name like '%\_url')`,
    );
    expect(res.rows).toEqual([]);
  });
});

describe("schema readiness for future additions", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createMigratedDb();
  });

  it("protects every public table with row level security", async () => {
    const res = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`,
    );
    expect(res.rows.map((r) => r.relname)).toEqual([]);
  });

  it("gives every public table a primary key", async () => {
    const res = await db.query<{ table_name: string }>(
      `select t.table_name from information_schema.tables t
        where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
          and not exists (
            select 1 from information_schema.table_constraints c
             where c.table_schema = t.table_schema and c.table_name = t.table_name and c.constraint_type = 'PRIMARY KEY')
        order by 1`,
    );
    expect(res.rows.map((r) => r.table_name)).toEqual([]);
  });

  it("uses uuid identifiers for every table owned by a user", async () => {
    const res = await db.query<{ table_name: string; data_type: string }>(
      `select table_name, data_type from information_schema.columns
        where table_schema = 'public' and column_name = 'user_id' and data_type <> 'uuid'`,
    );
    expect(res.rows).toEqual([]);
  });
});
