import { PackageContent } from "@/modules/plugins/contract";
import { canonicalJson, sha256Hex, sha256OfJson } from "@/modules/plugins/hash";
import { PackageManifest, sortAssets, type AssetContentType, type PackageAsset } from "./manifest";
import { writeZip } from "./zip";

export interface AssetInput {
  bytes: Uint8Array;
  type: AssetContentType;
}

export interface BuildInput {
  manifest: Omit<PackageManifest, "assets" | "sha256" | "items_count">;
  content: PackageContent;
  /** Keyed by their path inside the package (`assets/<name>.<ext>`). */
  assets: Record<string, AssetInput>;
}

export interface BuiltPackage {
  bytes: Uint8Array;
  manifest: PackageManifest;
  /** sha256 of the zip bytes: what the database pins for a version. */
  fileSha256: string;
}

/** The identity of a package's content: its items and the hashes of its assets, independent of the zip bytes. */
export function contentSha256(content: PackageContent, assets: readonly PackageAsset[]): string {
  return sha256OfJson({ content, assets: sortAssets(assets).map((a) => ({ path: a.path, sha256: a.sha256 })) });
}

export function describeAssets(assets: Record<string, AssetInput>): PackageAsset[] {
  return sortAssets(
    Object.entries(assets).map(([path, asset]) => ({
      path,
      type: asset.type,
      bytes: asset.bytes.length,
      sha256: sha256Hex(asset.bytes),
    })),
  );
}

/**
 * Writes a package: the manifest gets its asset list, item count and content
 * hash, then everything is zipped deterministically. The result is what the
 * validator must accept unchanged.
 */
export function buildPackage(input: BuildInput): BuiltPackage {
  const content = PackageContent.parse(input.content);
  const assets = describeAssets(input.assets);
  const manifest = PackageManifest.parse({
    ...input.manifest,
    items_count: content.items.length,
    assets,
    sha256: contentSha256(content, assets),
  });
  const encoder = new TextEncoder();
  const entries: Record<string, Uint8Array> = {
    "manifest.json": encoder.encode(JSON.stringify(manifest, null, 2)),
    "content.json": encoder.encode(canonicalJson(content)),
  };
  for (const [path, asset] of Object.entries(input.assets)) entries[path] = asset.bytes;
  const bytes = writeZip(entries);
  return { bytes, manifest, fileSha256: sha256Hex(bytes) };
}
