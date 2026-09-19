import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createMigratedDb, createUser, type Db } from "./harness";

/**
 * Files live in Cloudflare R2 behind the StorageProvider (decision R13,
 * ADR 0008); Supabase keeps accounts and metadata only. The migrations must
 * leave no bucket, no storage policy and no storage helper behind, and the
 * metadata rows keep relative object keys, never URLs (ADR 0005).
 */
describe("no files in Supabase Storage (decision R13)", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createMigratedDb();
  });

  it("leaves the former buckets inert: nobody can write to or read from them", async () => {
    const alice = await createUser(db, "storage_alice");
    const insert = () =>
      db.query("insert into storage.objects (bucket_id, name, metadata) values ('media-public', $1, '{}')", [
        `avatars/${alice}/a.png`,
      ]);
    await expect(asUser(db, alice, insert)).rejects.toThrow(/row-level security/);
    await expect(asAnon(db, insert)).rejects.toThrow(/row-level security/);
    const seen = await asUser(db, alice, () => db.query("select name from storage.objects"));
    expect(seen.rows).toEqual([]);
  });

  it("leaves no policy and no helper function on storage objects", async () => {
    const policies = await db.query<{ policyname: string }>(
      "select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'",
    );
    expect(policies.rows).toEqual([]);
    const functions = await db.query<{ proname: string }>(
      "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('package_readable', 'storage_object_owner')",
    );
    expect(functions.rows).toEqual([]);
  });

  it("keeps relative object keys in the metadata, never a bucket or a URL", async () => {
    const columns = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and (column_name like '%url%' or column_name like '%bucket%')`,
    );
    expect(columns.rows).toEqual([]);
    const keys = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and column_name in ('avatar_key', 'package_key')
        order by table_name, column_name`,
    );
    expect(keys.rows.map((c) => `${c.table_name}.${c.column_name}`)).toEqual([
      "content_items.package_key",
      "content_versions.package_key",
      "profile_cards.avatar_key",
      "profiles.avatar_key",
    ]);
  });
});
