import { beforeAll, describe, expect, it } from "vitest";
import { EXTENSION_BY_CONTENT_TYPE } from "../../src/modules/storage/keys";
import { asAnon, asUser, createMigratedDb, createUser, type Db } from "./harness";

/**
 * Storage buckets and object ownership (ADR 0005), verified against the
 * migrations with the Supabase Storage stub of the harness.
 */
describe("storage buckets and object ownership", () => {
  let db: Db;
  let alice: string;
  let bob: string;
  let moderator: string;

  const insertObject = (bucket: string, name: string) =>
    db.query("insert into storage.objects (bucket_id, name, metadata) values ($1, $2, '{}')", [bucket, name]);

  beforeAll(async () => {
    db = await createMigratedDb();
    alice = await createUser(db, "Alice");
    bob = await createUser(db, "bob_01");
    moderator = await createUser(db, "moderator");
    await db.query("insert into public.admin_ranks (user_id, rank) values ($1, 'moderator')", [moderator]);
  });

  it("defines one public and one private bucket that accept every content type the platform knows", async () => {
    const res = await db.query<{ id: string; public: boolean; allowed_mime_types: string[] }>(
      "select id, public, allowed_mime_types from storage.buckets order by id",
    );
    expect(res.rows.map((b) => [b.id, b.public])).toEqual([
      ["media-private", false],
      ["media-public", true],
    ]);
    const privateBucket = res.rows.find((b) => b.id === "media-private")!;
    for (const contentType of Object.keys(EXTENSION_BY_CONTENT_TYPE)) {
      expect(privateBucket.allowed_mime_types, contentType).toContain(contentType);
    }
  });

  it("reads the owner from the key layout area/<owner_id>/file only", async () => {
    const res = await db.query<{ owner: string | null }>(
      `select public.storage_object_owner(k) as owner
         from unnest(array['avatars/u1/a.png', 'a.png', 'avatars/u1/deep/a.png']) as k`,
    );
    expect(res.rows.map((r) => r.owner)).toEqual(["u1", null, null]);
  });

  it("lets users write only inside their own folder", async () => {
    await asUser(db, alice, () => insertObject("media-public", `avatars/${alice}/a.png`));
    await expect(asUser(db, alice, () => insertObject("media-public", `avatars/${bob}/hijack.png`))).rejects.toThrow(
      /row-level security/,
    );
    await expect(asUser(db, alice, () => insertObject("media-public", "loose.png"))).rejects.toThrow(
      /row-level security/,
    );
    await expect(asAnon(db, () => insertObject("media-public", `avatars/${alice}/anon.png`))).rejects.toThrow(
      /row-level security/,
    );
  });

  it("serves public objects to everyone and private objects to their owner and moderation", async () => {
    await asUser(db, alice, () => insertObject("media-private", `exports/${alice}/data.json`));

    const publicSeenByGuest = await asAnon(db, () =>
      db.query("select name from storage.objects where bucket_id = 'media-public'"),
    );
    expect(publicSeenByGuest.rows).toHaveLength(1);

    const privateSeenBy = async (userId: string) =>
      (await asUser(db, userId, () => db.query("select name from storage.objects where bucket_id = 'media-private'")))
        .rows.length;
    expect(await privateSeenBy(alice)).toBe(1);
    expect(await privateSeenBy(bob)).toBe(0);
    expect(await privateSeenBy(moderator)).toBe(1);
  });

  it("lets only the owner or moderation delete a public object", async () => {
    const name = `avatars/${alice}/a.png`;
    const byBob = await asUser(db, bob, () => db.query("delete from storage.objects where name = $1", [name]));
    expect(byBob.affectedRows).toBe(0);
    const byModerator = await asUser(db, moderator, () =>
      db.query("delete from storage.objects where name = $1", [name]),
    );
    expect(byModerator.affectedRows).toBe(1);
  });
});
