import "server-only";

import { PluginDefinition, PluginDraft, type PluginDraft as Draft } from "@/modules/plugins/contract";
import { sha256OfJson } from "@/modules/plugins/hash";
import { exportDefinition } from "@/modules/plugins/portable";
import { normalizeObjectKey, type StoredObjectRef } from "@/modules/storage/keys";
import { StorageError } from "@/modules/storage/provider";
import { getStorage } from "@/server/storage";

/**
 * Where plugin definitions live and how the server reads and writes them
 * (decision R13, completed 2026-09-19): a definition is a file in the private
 * store, exactly like a content package. The database keeps the key and the
 * sha256 of its canonical JSON, and every read verifies that hash before the
 * document is used, so a file that does not match its row is refused — the
 * platform never runs, renders or trusts a definition it cannot pin.
 *
 *   plugins/<owner_id>/<plugin_row_id>-draft.lisanplugin.json   the studio's working copy (rewritten on save)
 *   plugins/<owner_id>/<file_id>.lisanplugin.json               one immutable file per submitted version
 *   plugins/core/<plugin_id>-<version>.lisanplugin.json         the platform's reference plugins (npm run core:plugins:upload)
 *
 * Who may read which file is decided by row level security on the rows that
 * name them (a draft key is only ever read from a row its owner or moderation
 * can see); the store itself knows nothing about members.
 */

export const PLUGIN_STORE: StoredObjectRef["store"] = "private";
const CONTENT_TYPE = "application/json";

/** Owner folder of the key: the member's id, or `core` for the platform's own plugins. */
function folder(ownerId: string | null): string {
  return ownerId ?? "core";
}

export function draftDefinitionKey(ownerId: string | null, pluginRowId: string): string {
  return normalizeObjectKey(`plugins/${folder(ownerId)}/${pluginRowId}-draft.lisanplugin.json`);
}

export function versionDefinitionKey(ownerId: string | null, fileId: string): string {
  return normalizeObjectKey(`plugins/${folder(ownerId)}/${fileId}.lisanplugin.json`);
}

export function coreDefinitionKey(pluginId: string, version: string): string {
  return normalizeObjectKey(`plugins/core/${pluginId}-${version}.lisanplugin.json`);
}

// Definitions are immutable per hash, so a small in-process cache keyed by
// sha256 saves one round trip to the store per request (catalogue, player,
// package validation). Drafts change hash on every save and simply miss.
const CACHE_LIMIT = 200;
const definitions = new Map<string, PluginDefinition>();
const drafts = new Map<string, Draft>();

function remember<T>(cache: Map<string, T>, sha256: string, value: T): T {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(sha256, value);
  return value;
}

async function readJson(key: string): Promise<unknown | null> {
  const storage = await getStorage();
  let bytes: Uint8Array;
  try {
    bytes = await storage.download({ store: PLUGIN_STORE, key });
  } catch (error) {
    if (error instanceof StorageError && (error.code === "not_found" || error.code === "unauthorized")) return null;
    throw error;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** The `sha256` field written into every file is a convenience for people; the row's hash is what counts. */
function withoutHashField(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const { sha256: _ignored, ...rest } = value as Record<string, unknown>;
  void _ignored;
  return rest;
}

/**
 * A published definition by key, verified against the hash its row carries.
 * Null when the file is missing or does not hash to `sha256` — the caller then
 * treats the plugin as unavailable rather than rendering something unpinned.
 */
export async function loadDefinition(key: string, sha256: string): Promise<PluginDefinition | null> {
  const cached = definitions.get(sha256);
  if (cached) return cached;
  const document = withoutHashField(await readJson(key));
  if (document === null) return null;
  if (sha256OfJson(document) !== sha256) return null;
  const parsed = PluginDefinition.safeParse(document);
  if (!parsed.success) return null;
  return remember(definitions, sha256, parsed.data);
}

/** The studio's working copy, verified the same way; null when missing or tampered with. */
export async function loadDraft(key: string, sha256: string): Promise<Draft | null> {
  const cached = drafts.get(sha256);
  if (cached) return cached;
  const document = withoutHashField(await readJson(key));
  if (document === null) return null;
  if (sha256OfJson(document) !== sha256) return null;
  const parsed = PluginDraft.safeParse(document);
  if (!parsed.success) return null;
  return remember(drafts, sha256, parsed.data);
}

/** Rewrites the working copy in place and returns the hash the row must carry. */
export async function writeDraft(key: string, draft: Draft): Promise<{ sha256: string }> {
  const document = PluginDraft.parse(draft);
  const sha256 = sha256OfJson(document);
  const text = JSON.stringify({ ...document, sha256 }, null, 2) + "\n";
  const storage = await getStorage();
  await storage.upload({ store: PLUGIN_STORE, key }, new TextEncoder().encode(text), {
    contentType: CONTENT_TYPE,
    upsert: true,
  });
  remember(drafts, sha256, document);
  return { sha256 };
}

/** Writes an immutable version file (never overwritten) and returns its hash. */
export async function writeDefinition(key: string, definition: PluginDefinition): Promise<{ sha256: string }> {
  const sha256 = sha256OfJson(definition);
  const storage = await getStorage();
  await storage.upload({ store: PLUGIN_STORE, key }, new TextEncoder().encode(exportDefinition(definition)), {
    contentType: CONTENT_TYPE,
    upsert: false,
  });
  remember(definitions, sha256, definition);
  return { sha256 };
}

/** Best-effort removal of files whose rows are gone (a deleted draft, a failed submission). */
export async function removeDefinitionFiles(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const storage = await getStorage();
  await storage.remove(keys.map((key) => ({ store: PLUGIN_STORE, key }))).catch(() => undefined);
}
