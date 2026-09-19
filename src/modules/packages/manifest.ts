import { z } from "zod";
import { CefrLevel, LanguageSkill } from "@/modules/content/levels";
import { PluginId, Semver, Sha256Hex } from "@/modules/plugins/contract";

/**
 * `manifest.json` of a `.lisanpkg` package (ADR 0006 §3). Everything the
 * platform indexes about a package is here; the items live in `content.json`
 * and the pictures under `assets/`. Nothing in a package is a URL.
 */

export const PACKAGE_FORMAT = "lisanhub.package/1" as const;
export const PACKAGE_EXTENSION = ".lisanpkg";
export const PACKAGE_CONTENT_TYPE = "application/zip";

export const ASSET_PATH_PATTERN = /^assets\/[a-z0-9][a-z0-9._-]{0,80}\.(png|jpg|jpeg|webp|gif)$/;
export const AssetPath = z.string().regex(ASSET_PATH_PATTERN, "asset_path");

export const ASSET_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type AssetContentType = (typeof ASSET_CONTENT_TYPES)[number];

export const PackageAsset = z.object({
  path: AssetPath,
  type: z.enum(ASSET_CONTENT_TYPES),
  bytes: z.number().int().min(1),
  sha256: Sha256Hex,
});
export type PackageAsset = z.infer<typeof PackageAsset>;

const LanguageCode = z.string().regex(/^[a-z]{3}$/, "language_code");
const DialectTag = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "dialect_tag");
const Tag = z.string().min(1).max(40);

export const PackageAuthor = z.object({
  user_id: z.uuid(),
  username: z.string().min(1).max(30),
  display_name: z.string().min(1).max(80),
});

/** Attribution captured when a package is derived from another one (S4); carried from the start so nothing blocks it later. */
export const PackageProvenance = z.object({
  package_id: z.uuid(),
  version: z.number().int().min(1),
  sha256: Sha256Hex,
  author: PackageAuthor,
});

export const PackageManifest = z.object({
  format: z.literal(PACKAGE_FORMAT),
  package_id: z.uuid(),
  /** 0 while a draft, then the published version number. */
  version: z.number().int().min(0),
  plugin: z.object({ id: PluginId, version: Semver, schema_version: z.number().int().min(1) }),
  language_pair: z.object({ source: LanguageCode, target: LanguageCode, dialect: DialectTag.optional() }),
  cefr: z.nullable(CefrLevel),
  cefr_sublevel: z.number().int().min(1).max(9).nullable().default(null),
  skills: z.array(LanguageSkill).max(4),
  tags: z.array(Tag).max(20),
  title: z.string().min(1).max(200),
  summary: z.string().max(2000),
  license: z.string().max(100).nullable(),
  author: PackageAuthor,
  provenance: PackageProvenance.nullable(),
  items_count: z.number().int().min(0),
  created_at: z.iso.datetime(),
  assets: z.array(PackageAsset).max(1000),
  /** Hash of `content.json` (canonical) and the asset list: the identity of the content, whatever the zip bytes. */
  sha256: Sha256Hex,
});
export type PackageManifest = z.infer<typeof PackageManifest>;

/** Sorted so the same content always produces the same manifest. */
export function sortAssets(assets: readonly PackageAsset[]): PackageAsset[] {
  return [...assets].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
