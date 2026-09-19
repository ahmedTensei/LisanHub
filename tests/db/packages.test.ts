import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { isEmptyFieldValue } from "@/modules/plugins/fields";
import {
  asUser,
  createMigratedDb,
  createReferencePlugin,
  createUser,
  packageKey,
  PACKAGE_SHA,
  type Db,
} from "./harness";

/**
 * Content is a package file (decision R7): the database indexes it, points
 * versions at immutable files, rolls back by moving a pointer, and never
 * stores a body. Courses order their author's own packages (decision R11).
 */
describe("packages, versions, rollback and courses", () => {
  let db: Db;
  let creator: string;
  let other: string;
  let student: string;
  let moderator: string;
  let plugin: string;

  async function createPackage(ownerId: string, title: string, status: "draft" | "published" = "draft") {
    return asUser(db, ownerId, async () => {
      const item = await db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id, package_key, package_sha256)
         values ('package', $1, 'ara', 'fra', $2, $3, $4, $5) returning id`,
        [ownerId, title, plugin, packageKey(ownerId, "draft-" + title.toLowerCase()), PACKAGE_SHA],
      );
      const itemId = item.rows[0].id;
      if (status === "published") {
        const version = await db.query<{ id: string }>(
          `insert into public.content_versions (item_id, package_key, package_sha256, items_count) values ($1, $2, $3, 2) returning id`,
          [itemId, packageKey(ownerId, itemId + "-v1"), PACKAGE_SHA],
        );
        await db.query("update public.content_items set status = 'published', current_version_id = $2 where id = $1", [
          itemId,
          version.rows[0].id,
        ]);
      }
      return itemId;
    });
  }

  beforeAll(async () => {
    db = await createMigratedDb();
    creator = await createUser(db, "pkg_creator");
    other = await createUser(db, "pkg_other");
    student = await createUser(db, "pkg_student");
    moderator = await createUser(db, "pkg_mod");
    await db.query("insert into public.admin_ranks (user_id, rank) values ($1, 'moderator')", [moderator]);
    for (const id of [creator, other]) await asUser(db, id, () => db.query("select public.become_content_creator()"));
    plugin = await createReferencePlugin(db, "reference-plugin");
  });

  it("stores no content body: every version points at a package file and a hash", async () => {
    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'content_versions'",
    );
    const names = columns.rows.map((r) => r.column_name);
    expect(names).not.toContain("body");
    expect(names).toEqual(
      expect.arrayContaining(["package_key", "package_sha256", "plugin_version_id", "items_count"]),
    );

    const itemId = await createPackage(creator, "Alpha");
    await expect(
      asUser(db, creator, () => db.query("insert into public.content_versions (item_id) values ($1)", [itemId])),
    ).rejects.toThrow(/null value|not-null/);
    await expect(
      asUser(db, creator, () =>
        db.query(
          "insert into public.content_versions (item_id, package_key, package_sha256) values ($1, 'https://x/y.zip', $2)",
          [itemId, PACKAGE_SHA],
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("retires lesson and deck kinds, ties packages to a plugin and keeps courses plugin-free", async () => {
    const insert = (kind: string, withPlugin: boolean) =>
      asUser(db, creator, () =>
        db.query(
          `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id)
           values ($1, $2, 'ara', 'fra', 'Kind test', $3)`,
          [kind, creator, withPlugin ? plugin : null],
        ),
      );
    await expect(insert("lesson", true)).rejects.toThrow(/content_items_kind_plugin/);
    await expect(insert("deck", false)).rejects.toThrow(/content_items_kind_plugin/);
    await expect(insert("package", false)).rejects.toThrow(/content_items_kind_plugin/);
    await expect(insert("course", true)).rejects.toThrow(/content_items_kind_plugin/);
    await expect(insert("course", false)).resolves.toBeTruthy();
  });

  it("refuses to publish a package that has no version yet", async () => {
    const itemId = await createPackage(creator, "Beta");
    await expect(
      asUser(db, creator, () =>
        db.query("update public.content_items set status = 'published' where id = $1", [itemId]),
      ),
    ).rejects.toThrow(/needs a published version/);
  });

  it("rolls back by adding a version that points at the earlier file, audited, for the owner or moderation only", async () => {
    const itemId = await createPackage(creator, "Gamma", "published");
    const v1 = await db.query<{ id: string; package_key: string }>(
      "select id, package_key from public.content_versions where item_id = $1 order by version_number",
      [itemId],
    );
    const v2 = await asUser(db, creator, () =>
      db.query<{ id: string }>(
        "insert into public.content_versions (item_id, package_key, package_sha256, items_count) values ($1, $2, $3, 3) returning id",
        [itemId, packageKey(creator, itemId + "-v2"), "e".repeat(64)],
      ),
    );
    await asUser(db, creator, () =>
      db.query("update public.content_items set current_version_id = $2, package_sha256 = $3 where id = $1", [
        itemId,
        v2.rows[0].id,
        "e".repeat(64),
      ]),
    );

    await expect(
      asUser(db, other, () => db.query("select public.rollback_content_version($1, $2)", [itemId, v1.rows[0].id])),
    ).rejects.toThrow(/only the owner or moderation|content not found/);
    await expect(
      asUser(db, creator, () => db.query("select public.rollback_content_version($1, $2)", [itemId, v2.rows[0].id])),
    ).rejects.toThrow(/already the current version/);

    const rolled = await asUser(db, creator, () =>
      db.query<{ rollback_content_version: string }>("select public.rollback_content_version($1, $2)", [
        itemId,
        v1.rows[0].id,
      ]),
    );
    const v3 = await db.query<{ version_number: number; package_key: string; change_note: string }>(
      "select version_number, package_key, change_note from public.content_versions where id = $1",
      [rolled.rows[0].rollback_content_version],
    );
    expect(v3.rows[0]).toEqual({ version_number: 3, package_key: v1.rows[0].package_key, change_note: "rollback:1" });
    const item = await db.query<{ current_version_id: string; package_sha256: string; items_count: number }>(
      "select current_version_id, package_sha256, items_count from public.content_items where id = $1",
      [itemId],
    );
    expect(item.rows[0]).toEqual({
      current_version_id: rolled.rows[0].rollback_content_version,
      package_sha256: PACKAGE_SHA,
      items_count: 2,
    });

    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from public.audit_log where target_table = 'content_versions' and target_id = $1",
      [rolled.rows[0].rollback_content_version],
    );
    expect(audit.rows[0].n).toBe(1);

    // Moderation may roll back too; a Student never can.
    await asUser(db, moderator, () =>
      db.query("select public.rollback_content_version($1, $2)", [itemId, v2.rows[0].id]),
    );
    await expect(
      asUser(db, student, () => db.query("select public.rollback_content_version($1, $2)", [itemId, v1.rows[0].id])),
    ).rejects.toThrow(/only the owner or moderation|content not found/);
  });

  it("lets a course order the author's own packages only, without deleting them", async () => {
    const course = await asUser(db, creator, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title)
         values ('course', $1, 'ara', 'fra', 'My course') returning id`,
        [creator],
      ),
    );
    const courseId = course.rows[0].id;
    const mine = await createPackage(creator, "Delta", "published");
    const mineDraft = await createPackage(creator, "Epsilon");
    const theirs = await createPackage(other, "Zeta", "published");

    const add = (who: string, lesson: string, position: number) =>
      asUser(db, who, () =>
        db.query("insert into public.course_lessons (course_id, lesson_id, position) values ($1, $2, $3)", [
          courseId,
          lesson,
          position,
        ]),
      );
    await add(creator, mine, 0);
    await add(creator, mineDraft, 1);
    await expect(add(creator, theirs, 2)).rejects.toThrow(/row-level security/);
    await expect(add(creator, courseId, 2)).rejects.toThrow(/a course holds packages only/);
    await expect(add(other, mine, 2)).rejects.toThrow(/row-level security/);

    await asUser(db, creator, () =>
      db.query(
        "update public.course_lessons set position = case lesson_id when $2 then 1 else 0 end where course_id = $1",
        [courseId, mine],
      ),
    );
    const order = await asUser(db, creator, () =>
      db.query<{ lesson_id: string }>(
        "select lesson_id from public.course_lessons where course_id = $1 order by position",
        [courseId],
      ),
    );
    expect(order.rows.map((r) => r.lesson_id)).toEqual([mineDraft, mine]);

    await asUser(db, creator, () =>
      db.query("delete from public.course_lessons where course_id = $1 and lesson_id = $2", [courseId, mineDraft]),
    );
    const still = await db.query("select id from public.content_items where id = $1", [mineDraft]);
    expect(still.rows).toHaveLength(1);
  });

  it("keeps a course inside its language pair and locks the pair once items are linked (decision R15)", async () => {
    const course = await asUser(db, creator, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title)
         values ('course', $1, 'ara', 'fra', 'Pair course') returning id`,
        [creator],
      ),
    );
    const otherPair = await asUser(db, creator, () =>
      db.query<{ id: string }>(
        `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, plugin_id, package_key, package_sha256)
         values ('package', $1, 'ara', 'eng', 'English pack', $2, $3, $4) returning id`,
        [creator, plugin, packageKey(creator, "draft-english-pack"), PACKAGE_SHA],
      ),
    );
    const samePair = await createPackage(creator, "Kappa");
    const add = (lesson: string) =>
      asUser(db, creator, () =>
        db.query("insert into public.course_lessons (course_id, lesson_id, position) values ($1, $2, 0)", [
          course.rows[0].id,
          lesson,
        ]),
      );
    await expect(add(otherPair.rows[0].id)).rejects.toThrow(/own language pair only/);
    await add(samePair);
    await expect(
      asUser(db, creator, () =>
        db.query("update public.content_items set target_lang = 'eng' where id = $1", [samePair]),
      ),
    ).rejects.toThrow(/cannot change while the item belongs to a course/);
  });

  it("requires an English title and accepts optional translations only for interface languages (decision R16)", async () => {
    const insert = (title: string, translations = "{}") =>
      asUser(db, creator, () =>
        db.query(
          `insert into public.content_items (kind, owner_id, source_lang, target_lang, title, translations)
           values ('course', $1, 'ara', 'fra', $2, $3::jsonb)`,
          [creator, title, translations],
        ),
      );
    await expect(insert("مقدمة")).rejects.toThrow(/content_items_title_latin/);
    await expect(insert(" leading space")).rejects.toThrow(/content_items_title_latin/);
    await insert(
      "Greetings & farewells, part 1 (A1)",
      '{"ar": {"title": "تحيات ووداع"}, "fr": {"summary": "Bonjour"}}',
    );
    await expect(insert("Bad locale", '{"de": {"title": "Hallo"}}')).rejects.toThrow(
      /content_items_translations_valid/,
    );
    await expect(insert("Bad field", '{"ar": {"body": "x"}}')).rejects.toThrow(/content_items_translations_valid/);
    await expect(insert("Bad shape", '["ar"]')).rejects.toThrow(/content_items_translations_valid/);
  });

  it("keeps every package key in the private area of the owner who wrote it", async () => {
    const published = await createPackage(creator, "Theta", "published");
    const version = await db.query<{ package_key: string }>(
      "select package_key from public.content_versions where item_id = $1",
      [published],
    );
    expect(version.rows[0].package_key).toMatch(new RegExp(`^packages/${creator}/[a-z0-9-]+\.lisanpkg$`));
  });
});

describe("no fake content (decision R8)", () => {
  const root = join(__dirname, "..", "..");
  const migrationsDir = join(root, "supabase", "migrations");

  it("never inserts content, members or ratings from a migration or seed.sql", () => {
    const files = readdirSync(migrationsDir).map((f) => join(migrationsDir, f));
    const seed = join(root, "supabase", "seed.sql");
    if (existsSync(seed)) files.push(seed);
    const forbidden =
      /insert\s+into\s+public\.(content_items|content_versions|course_lessons|profiles|ratings|reports|feedback|chat_messages|progress)\b/i;
    // Function bodies (dollar-quoted) insert rows at runtime for real users; only top-level inserts seed data.
    const topLevel = (sql: string) => sql.replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, "");
    const offenders = files.filter((f) => forbidden.test(topLevel(readFileSync(f, "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("leaves every content table empty after the migrations, and seeded templates carry no values", async () => {
    const db = await createMigratedDb();
    for (const table of ["content_items", "content_versions", "course_lessons", "ratings", "reports"]) {
      const count = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
      expect(count.rows[0].n, table).toBe(0);
    }
    // Plugin definitions are files (decision R13): the seeded rows only name the exported files,
    // whose templates are checked in tests/db/core-plugins.test.ts and here from the file itself.
    const versions = await db.query<{ definition_key: string }>("select definition_key from public.plugin_versions");
    for (const row of versions.rows) {
      const file = row.definition_key.match(/^plugins\/core\/([a-z0-9-]+)-\d+\.\d+\.\d+\.lisanplugin\.json$/);
      expect(file, row.definition_key).not.toBeNull();
      const exported = JSON.parse(readFileSync(join(root, "plugins", "core", `${file![1]}.lisanplugin.json`), "utf8"));
      for (const template of exported.templates ?? []) {
        for (const item of template.items ?? []) {
          expect(Object.keys(item).every((k) => k === "activity" || k === "hints")).toBe(true);
          if ("fields" in item) expect(isEmptyFieldValue(item.fields)).toBe(true);
        }
      }
    }
  });
});
