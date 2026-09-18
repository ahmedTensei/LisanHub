import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createMigratedDb, createUser, type Db } from "./harness";

/**
 * S1 invariants: accounts, profile visibility, the Student -> Content Creator
 * transition and language pairs, verified against the real migrations with row
 * level security enforced (docs/prompts/S1-accounts-roles-languages.md).
 */
describe("accounts, roles and language pairs", () => {
  let db: Db;
  let alice: string;
  let bob: string;
  let moderator: string;

  beforeAll(async () => {
    db = await createMigratedDb();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "bob_01");
    moderator = await createUser(db, "moderator");
    await db.query("insert into public.admin_ranks (user_id, rank) values ($1, 'moderator')", [moderator]);
  });

  it("creates every account as a public Student profile", async () => {
    const res = await db.query<{ primary_role: string; visibility: string }>(
      "select primary_role, visibility from public.profiles where id = $1",
      [alice],
    );
    expect(res.rows[0]).toEqual({ primary_role: "student", visibility: "public" });
  });

  it("gives every account a unique username, case-insensitively, of 4 to 30 handle characters", async () => {
    await expect(createUser(db, "alice")).rejects.toThrow(/profiles_username_unique/);
    await expect(createUser(db, "abc")).rejects.toThrow(/profiles_username_check/);
    await expect(createUser(db, "with space")).rejects.toThrow(/profiles_username_check/);
    await expect(createUser(db, ".dotfirst")).rejects.toThrow(/profiles_username_check/);

    const availability = await asAnon(db, () =>
      db.query<{ free: boolean }>(
        "select public.username_available(u) as free from unnest(array['ALICE', 'new_user', 'ab']) as u",
      ),
    );
    expect(availability.rows.map((r) => r.free)).toEqual([false, true, false]);

    // Accounts created without a username (dashboard, imports) still get a valid one.
    const id = crypto.randomUUID();
    await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, '{}')", [id]);
    const generated = await db.query<{ username: string; display_name: string }>(
      "select username, display_name from public.profiles where id = $1",
      [id],
    );
    expect(generated.rows[0].username).toMatch(/^user_[0-9a-f]{8}$/);
    expect(generated.rows[0].display_name).toBe(generated.rows[0].username);
  });

  it("keeps a free-form display name in any script next to the Latin username", async () => {
    const id = crypto.randomUUID();
    await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [
      id,
      JSON.stringify({ username: "amel_2026", display_name: "أمل بن يوسف" }),
    ]);
    const row = await db.query<{ username: string; display_name: string }>(
      "select username, display_name from public.profiles where id = $1",
      [id],
    );
    expect(row.rows[0]).toEqual({ username: "amel_2026", display_name: "أمل بن يوسف" });

    const own = await asUser(db, id, () =>
      db.query("update public.profiles set display_name = $2 where id = $1", [id, "Amel"]),
    );
    expect(own.affectedRows).toBe(1);
    await expect(
      asUser(db, id, () => db.query("update public.profiles set display_name = $2 where id = $1", [id, ""])),
    ).rejects.toThrow(/profiles_display_name_check/);
  });

  it("lets a user restrict their own profile but not someone else's", async () => {
    const own = await asUser(db, alice, () =>
      db.query("update public.profiles set visibility = 'restricted' where id = $1", [alice]),
    );
    expect(own.affectedRows).toBe(1);

    const other = await asUser(db, bob, () =>
      db.query("update public.profiles set visibility = 'restricted' where id = $1", [alice]),
    );
    expect(other.affectedRows).toBe(0);
  });

  it("hides a restricted profile from other users and guests, not from its owner or moderation", async () => {
    const seenBy = async (run: <T>(fn: () => Promise<T>) => Promise<T>) =>
      (await run(() => db.query("select id from public.profiles where id = $1", [alice]))).rows.length;

    expect(await seenBy((fn) => asUser(db, bob, fn))).toBe(0);
    expect(await seenBy((fn) => asAnon(db, fn))).toBe(0);
    expect(await seenBy((fn) => asUser(db, alice, fn))).toBe(1);
    expect(await seenBy((fn) => asUser(db, moderator, fn))).toBe(1);
  });

  it("keeps the display name of a restricted profile available for attribution, without private columns", async () => {
    const card = await asUser(db, bob, () =>
      db.query<{ username: string }>("select username from public.profile_cards where id = $1", [alice]),
    );
    expect(card.rows[0].username).toBe("Alice");

    const columns = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profile_cards'",
    );
    expect(columns.rows.map((r) => r.column_name).sort()).toEqual(
      ["avatar_key", "display_name", "id", "is_founding_member", "primary_role", "username"].sort(),
    );
  });

  it("lets a Student become a Content Creator through the platform function only", async () => {
    const first = await asUser(db, bob, () =>
      db.query<{ become_content_creator: string }>("select public.become_content_creator()"),
    );
    expect(first.rows[0].become_content_creator).toBe("content_creator");

    // Calling it again is harmless.
    const again = await asUser(db, bob, () =>
      db.query<{ become_content_creator: string }>("select public.become_content_creator()"),
    );
    expect(again.rows[0].become_content_creator).toBe("content_creator");

    // There is no way back through direct writes.
    await expect(
      asUser(db, bob, () => db.query("update public.profiles set primary_role = 'student' where id = $1", [bob])),
    ).rejects.toThrow(/permission denied/);

    // Guests cannot call it at all.
    await expect(asAnon(db, () => db.query("select public.become_content_creator()"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("returns a Content Creator to Student only through an Administrator (support review)", async () => {
    const admin = await createUser(db, "admin_01");
    await db.query("insert into public.admin_ranks (user_id, rank) values ($1, 'administrator')", [admin]);

    // Neither the member nor a moderator can do it.
    await expect(
      asUser(db, bob, () => db.query("select public.admin_set_primary_role($1, 'student')", [bob])),
    ).rejects.toThrow(/administrator rank required/);
    await expect(
      asUser(db, moderator, () => db.query("select public.admin_set_primary_role($1, 'student')", [bob])),
    ).rejects.toThrow(/administrator rank required/);
    await expect(
      asAnon(db, () => db.query("select public.admin_set_primary_role($1, 'student')", [bob])),
    ).rejects.toThrow(/permission denied/);

    const reverted = await asUser(db, admin, () =>
      db.query<{ admin_set_primary_role: string }>("select public.admin_set_primary_role($1, 'student')", [bob]),
    );
    expect(reverted.rows[0].admin_set_primary_role).toBe("student");
    await expect(
      asUser(db, admin, () => db.query("select public.admin_set_primary_role($1, 'contributor')", [bob])),
    ).rejects.toThrow(/not open yet/);

    const audit = await db.query<{ actor_id: string; role_after: string }>(
      `select actor_id, after ->> 'primary_role' as role_after from public.audit_log
        where target_table = 'profiles' and target_id = $1 order by id desc limit 1`,
      [bob],
    );
    expect(audit.rows[0]).toEqual({ actor_id: admin, role_after: "student" });

    // Back to creator for the remaining tests.
    await asUser(db, admin, () => db.query("select public.admin_set_primary_role($1, 'content_creator')", [bob]));
  });

  it("writes an audit record for the role change", async () => {
    const res = await db.query<{ actor_id: string; action: string; role_after: string }>(
      `select actor_id, action, after ->> 'primary_role' as role_after
         from public.audit_log
        where target_table = 'profiles' and target_id = $1 order by id`,
      [bob],
    );
    expect(res.rows[0]).toEqual({ actor_id: bob, action: "update", role_after: "content_creator" });
  });

  it("lets users manage only their own language pairs, even with direct database access", async () => {
    const pair = await asUser(db, alice, () =>
      db.query<{ id: string }>(
        `insert into public.language_pairs (user_id, native_lang, target_lang, dialect_tag, goal)
         values ($1, 'arq', 'fra', 'paris', 'Study in France') returning id`,
        [alice],
      ),
    );
    const pairId = pair.rows[0].id;

    await expect(
      asUser(db, alice, () =>
        db.query("insert into public.language_pairs (user_id, native_lang, target_lang) values ($1, 'arq', 'eng')", [
          bob,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);

    const read = await asUser(db, bob, () =>
      db.query("select id from public.language_pairs where user_id = $1", [alice]),
    );
    expect(read.rows).toHaveLength(0);

    const update = await asUser(db, bob, () =>
      db.query("update public.language_pairs set goal = 'Hijacked' where id = $1", [pairId]),
    );
    expect(update.affectedRows).toBe(0);

    const remove = await asUser(db, bob, () => db.query("delete from public.language_pairs where id = $1", [pairId]));
    expect(remove.affectedRows).toBe(0);

    const ownRemove = await asUser(db, alice, () =>
      db.query("delete from public.language_pairs where id = $1", [pairId]),
    );
    expect(ownRemove.affectedRows).toBe(1);
  });

  it("rejects a pair of one language with itself, and a duplicate pair", async () => {
    await expect(
      asUser(db, alice, () =>
        db.query("insert into public.language_pairs (user_id, native_lang, target_lang) values ($1, 'fra', 'fra')", [
          alice,
        ]),
      ),
    ).rejects.toThrow(/language_pairs_distinct_languages/);

    await asUser(db, alice, () =>
      db.query("insert into public.language_pairs (user_id, native_lang, target_lang) values ($1, 'kab', 'eng')", [
        alice,
      ]),
    );
    await expect(
      asUser(db, alice, () =>
        db.query("insert into public.language_pairs (user_id, native_lang, target_lang) values ($1, 'kab', 'eng')", [
          alice,
        ]),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("finds languages by ISO code and English name, for guests too", async () => {
    const byCode = await asAnon(db, () =>
      db.query<{ code: string }>("select code from public.search_languages('kab', 5)"),
    );
    expect(byCode.rows[0].code).toBe("kab");

    const byShortCode = await asAnon(db, () =>
      db.query<{ code: string }>("select code from public.search_languages('fr', 5)"),
    );
    expect(byShortCode.rows[0].code).toBe("fra");

    const byName = await asUser(db, alice, () =>
      db.query<{ code: string; name_en: string }>("select code, name_en from public.search_languages('algerian', 10)"),
    );
    expect(byName.rows.map((r) => r.code)).toEqual(expect.arrayContaining(["arq", "aao"]));

    const empty = await asAnon(db, () => db.query("select code from public.search_languages('   ', 5)"));
    expect(empty.rows).toHaveLength(0);
  });
});
