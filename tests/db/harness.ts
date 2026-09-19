import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export type Db = PGlite;

/** Creates an in-memory Postgres with the Supabase stub and every migration applied. */
export async function createMigratedDb(): Promise<Db> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

/** Inserts an auth user (as the platform would, with the chosen username) and returns its id. */
export async function createUser(db: Db, username: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [id, JSON.stringify({ username })]);
  return id;
}

/** Runs `fn` as a signed-in user under row level security, then restores the superuser session. */
export async function asUser<T>(db: Db, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Runs `fn` as an anonymous visitor under row level security. */
export async function asAnon<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/**
 * Inserts a published platform plugin (owner null, like seeded reference data)
 * with one version, as a migration would. Returns the plugins.id.
 */
export async function createReferencePlugin(db: Db, pluginId = "test-plugin"): Promise<string> {
  const plugin = await db.query<{ id: string }>(
    "insert into public.plugins (plugin_id, status) values ($1, 'published') returning id",
    [pluginId],
  );
  const id = plugin.rows[0].id;
  // The definition itself is a file in the store (decision R13); the row carries its key and hash.
  const key = `plugins/core/${pluginId}-1.0.0.lisanplugin.json`;
  const version = await db.query<{ id: string }>(
    `insert into public.plugin_versions (plugin_id, version, schema_version, definition_key, definition_sha256)
     values ($1, '1.0.0', 1, $2, $3) returning id`,
    [id, key, "c".repeat(64)],
  );
  await db.query("update public.plugins set current_version_id = $2, draft_key = $3, draft_sha256 = $4 where id = $1", [
    id,
    version.rows[0].id,
    key,
    "c".repeat(64),
  ]);
  return id;
}

export const PACKAGE_SHA = "b".repeat(64);
export const packageKey = (ownerId: string, objectId: string) => `packages/${ownerId}/${objectId}.lisanpkg`;
