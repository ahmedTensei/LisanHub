import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPackage, type AssetInput, type BuildInput } from "@/modules/packages/build";
import { PACKAGE_CONTENT_TYPE } from "@/modules/packages/manifest";
import { peekPackagePlugin, validatePackage, type PackageIssue, type ParsedPackage } from "@/modules/packages/validate";
import type { PackageContent, PluginDefinition } from "@/modules/plugins/contract";
import { normalizeObjectKey, type StoredObjectRef } from "@/modules/storage/keys";
import { StorageError } from "@/modules/storage/provider";
import { getStorage } from "@/server/storage";
import { getPackageLimits, resolvePublishedDefinition } from "@/server/queries/plugins";

/**
 * Where packages live and how the server reads and writes them (ADR 0006 §4,
 * ADR 0005). A content item has one working copy (`<item>-draft.lisanpkg`,
 * rewritten in place on every save) and one immutable file per published
 * version. Both are private objects; row level security on the storage
 * objects decides who may read which (owner, moderation, members for the
 * current published version).
 */

export const PACKAGE_STORE: StoredObjectRef["store"] = "private";

export function draftPackageKey(ownerId: string, itemId: string): string {
  return normalizeObjectKey(`packages/${ownerId}/${itemId}-draft.lisanpkg`);
}

export function versionPackageKey(ownerId: string, versionId: string): string {
  return normalizeObjectKey(`packages/${ownerId}/${versionId}.lisanpkg`);
}

export type LoadedPackage =
  | { ok: true; bytes: Uint8Array; package: ParsedPackage; pluginVersionId: string }
  | { ok: false; reason: "not_found" | "unreadable" | "invalid"; issues?: PackageIssue[] };

/** Downloads and validates a package file. Draft mode tolerates incomplete items (see validatePackage). */
export async function loadPackage(key: string, mode: "draft" | "publish"): Promise<LoadedPackage> {
  const storage = await getStorage();
  let bytes: Uint8Array;
  try {
    bytes = await storage.download({ store: PACKAGE_STORE, key });
  } catch (error) {
    if (error instanceof StorageError && (error.code === "not_found" || error.code === "unauthorized"))
      return { ok: false, reason: "not_found" };
    throw error;
  }
  return parsePackageBytes(bytes, mode);
}

export async function parsePackageBytes(bytes: Uint8Array, mode: "draft" | "publish"): Promise<LoadedPackage> {
  const peek = peekPackagePlugin(bytes);
  if (!peek) return { ok: false, reason: "unreadable" };
  const [limits, resolved] = await Promise.all([
    getPackageLimits(),
    resolvePublishedDefinition(peek.id, peek.schemaVersion),
  ]);
  const definition: PluginDefinition | null | "unknown_schema_version" =
    resolved === null || resolved === "unknown_schema_version" ? resolved : resolved.definition;
  const validation = validatePackage(bytes, { limits, mode, resolvePlugin: () => definition });
  if (!validation.ok) return { ok: false, reason: "invalid", issues: validation.issues };
  return {
    ok: true,
    bytes,
    package: validation.package,
    pluginVersionId: typeof resolved === "object" && resolved ? resolved.versionId : "",
  };
}

/** Rebuilds the working copy from structured state and overwrites it in place. Returns the new file hash. */
export async function writeDraftPackage(
  key: string,
  input: { manifest: BuildInput["manifest"]; content: PackageContent; assets: Record<string, AssetInput> },
): Promise<{ fileSha256: string; itemsCount: number }> {
  const built = buildPackage(input);
  const storage = await getStorage();
  await storage.upload({ store: PACKAGE_STORE, key }, built.bytes, { contentType: PACKAGE_CONTENT_TYPE, upsert: true });
  return { fileSha256: built.fileSha256, itemsCount: built.manifest.items_count };
}

/** Copies validated bytes to an immutable version key (never overwritten). */
export async function writeVersionPackage(key: string, bytes: Uint8Array): Promise<void> {
  const storage = await getStorage();
  await storage.upload({ store: PACKAGE_STORE, key }, bytes, { contentType: PACKAGE_CONTENT_TYPE, upsert: false });
}

/** The assets of a parsed package as build input (to rebuild the draft after an edit). */
export function assetsOf(parsed: ParsedPackage): Record<string, AssetInput> {
  return Object.fromEntries([...parsed.assets.entries()].map(([path, a]) => [path, { bytes: a.bytes, type: a.type }]));
}

/** Re-checks the current member can still see the item (row level security), for routes serving package bytes. */
export async function canReadItem(
  itemId: string,
): Promise<{ ownerId: string; status: string; packageKey: string | null; currentVersionId: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_items")
    .select("owner_id, status, package_key, current_version_id")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(`content item: ${error.message}`);
  return data
    ? {
        ownerId: data.owner_id,
        status: data.status,
        packageKey: data.package_key,
        currentVersionId: data.current_version_id,
      }
    : null;
}
