import "server-only";

import type { Actor } from "@/modules/authorization/roles";
import { canReadItem, loadPackage, type LoadedPackage } from "./store";
import { getContentVersion } from "@/server/queries/content";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type PackageAccess =
  | { ok: true; loaded: Extract<LoadedPackage, { ok: true }>; versionLabel: string; ownerId: string }
  | { ok: false; status: 401 | 404 | 422 };

/**
 * Resolves which package file the platform reads on behalf of a signed-in
 * member for an item: the working copy for its owner (and moderation), a
 * published version for everyone who can see the item (row level security on
 * the item decides). Only the player ever receives bytes from it, asset by
 * asset; the package file itself is never handed out (decision R14: no
 * download, import or export — content moves through the community).
 */
export async function resolvePackageAccess(
  actor: Actor,
  itemId: string,
  version: string | null,
): Promise<PackageAccess> {
  if (actor.kind !== "user") return { ok: false, status: 401 };
  if (!UUID.test(itemId)) return { ok: false, status: 404 };
  const item = await canReadItem(itemId);
  if (!item) return { ok: false, status: 404 };

  const wantsDraft = version === "draft" || (version === null && !item.currentVersionId);
  if (wantsDraft) {
    const mayEdit = item.ownerId === actor.userId || actor.adminRank !== null;
    if (!mayEdit || !item.packageKey) return { ok: false, status: 404 };
    const loaded = await loadPackage(item.packageKey, "draft");
    if (!loaded.ok) return { ok: false, status: loaded.reason === "invalid" ? 422 : 404 };
    return { ok: true, loaded, versionLabel: "draft", ownerId: item.ownerId };
  }

  const versionId = version ?? item.currentVersionId;
  if (!versionId || !UUID.test(versionId)) return { ok: false, status: 404 };
  const row = await getContentVersion(itemId, versionId);
  if (!row) return { ok: false, status: 404 };
  const loaded = await loadPackage(row.packageKey, "publish");
  if (!loaded.ok) return { ok: false, status: loaded.reason === "invalid" ? 422 : 404 };
  return { ok: true, loaded, versionLabel: `v${row.versionNumber}`, ownerId: item.ownerId };
}
