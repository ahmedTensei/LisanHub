import { PackageContent, type PluginDefinition } from "@/modules/plugins/contract";
import { FIELD_VALUE_SCHEMAS } from "@/modules/plugins/fields";
import { sha256Hex } from "@/modules/plugins/hash";
import { compileJsonSchema } from "@/modules/plugins/json-schema";
import type { PackageLimits } from "@/modules/platform/settings";
import { contentSha256 } from "./build";
import { ASSET_PATH_PATTERN, PackageManifest, type AssetContentType } from "./manifest";
import { sniffImageType } from "./sniff";
import { listZipEntries, readZipEntries, ZipFormatError } from "./zip";

/**
 * Every check a package must pass before the platform stores, publishes or
 * plays it (ADR 0006 §3, `plugin-architecture`). Fails closed: the first
 * category of problem found is reported with translatable codes, and nothing
 * is inflated before its declared size passed the limit.
 */

export const PACKAGE_ISSUE_CODES = [
  "not_a_package",
  "too_large",
  "too_many_entries",
  "bad_entry_path",
  "symlink_entry",
  "entry_too_large",
  "missing_manifest",
  "missing_content",
  "manifest_invalid",
  "content_invalid",
  "too_many_items",
  "too_many_assets",
  "asset_too_large",
  "asset_missing",
  "asset_undeclared",
  "asset_type_mismatch",
  "asset_sha256_mismatch",
  "asset_reference_missing",
  "items_count_mismatch",
  "duplicate_item_id",
  "unknown_plugin",
  "unknown_schema_version",
  "schema_mismatch",
  "sha256_mismatch",
] as const;
export type PackageIssueCode = (typeof PACKAGE_ISSUE_CODES)[number];

export interface PackageIssue {
  code: PackageIssueCode;
  /** Entry name, JSON pointer or asset path the issue refers to. */
  path?: string;
}

export interface ParsedPackage {
  manifest: PackageManifest;
  content: PackageContent;
  assets: Map<string, { bytes: Uint8Array; type: AssetContentType }>;
  /** sha256 of the zip bytes. */
  fileSha256: string;
  plugin: PluginDefinition;
}

export type PackageValidation = { ok: true; package: ParsedPackage } | { ok: false; issues: PackageIssue[] };

export interface ValidateOptions {
  limits: PackageLimits;
  /** The published definition of a plugin for the schema version the package declares, or null. */
  resolvePlugin: (pluginId: string, schemaVersion: number) => PluginDefinition | null | "unknown_schema_version";
  /**
   * A working copy being edited: items may still be incomplete, so the content
   * schema and image references are not enforced yet. Every structural, size,
   * path, type and hash rule still applies. Publication always uses the full mode.
   */
  mode?: "publish" | "draft";
}

const MANIFEST_MAX_BYTES = 256 * 1024;

export function validatePackage(bytes: Uint8Array, options: ValidateOptions): PackageValidation {
  const { limits } = options;
  const fail = (...issues: PackageIssue[]): PackageValidation => ({ ok: false, issues });

  if (bytes.length > limits.max_bytes) return fail({ code: "too_large" });

  let entries;
  try {
    entries = listZipEntries(bytes);
  } catch (error) {
    if (error instanceof ZipFormatError) return fail({ code: "not_a_package" });
    throw error;
  }
  if (entries.length > 2 + limits.max_assets) return fail({ code: "too_many_entries" });

  const pathIssues: PackageIssue[] = [];
  for (const entry of entries) {
    if (entry.isSymlink) pathIssues.push({ code: "symlink_entry", path: entry.name });
    else if (entry.isDirectory || !isAllowedEntry(entry.name))
      pathIssues.push({ code: "bad_entry_path", path: entry.name });
    else if (entry.uncompressedSize > entryLimit(entry.name, limits)) {
      pathIssues.push({
        code: entry.name.startsWith("assets/") ? "asset_too_large" : "entry_too_large",
        path: entry.name,
      });
    }
  }
  if (pathIssues.length > 0) return fail(...pathIssues);
  const names = entries.map((e) => e.name);
  if (new Set(names).size !== names.length) return fail({ code: "bad_entry_path", path: "duplicate" });
  if (!names.includes("manifest.json")) return fail({ code: "missing_manifest" });
  if (!names.includes("content.json")) return fail({ code: "missing_content" });

  let files: Record<string, Uint8Array>;
  try {
    files = readZipEntries(bytes, (name) => entryLimit(name, limits));
  } catch {
    return fail({ code: "not_a_package" });
  }

  const manifestParsed = safeJson(files["manifest.json"]);
  const manifest = manifestParsed === undefined ? null : PackageManifest.safeParse(manifestParsed);
  if (!manifest || !manifest.success) {
    return fail({ code: "manifest_invalid", path: manifest?.error.issues[0]?.path.join(".") });
  }
  const contentParsed = safeJson(files["content.json"]);
  const content = contentParsed === undefined ? null : PackageContent.safeParse(contentParsed);
  if (!content || !content.success) {
    return fail({ code: "content_invalid", path: content?.error.issues[0]?.path.join(".") });
  }
  const m = manifest.data;
  const c = content.data;

  if (c.items.length > limits.max_items) return fail({ code: "too_many_items" });
  if (m.items_count !== c.items.length) return fail({ code: "items_count_mismatch" });
  const ids = new Set<string>();
  for (const item of c.items) {
    if (ids.has(item.item_id)) return fail({ code: "duplicate_item_id", path: item.item_id });
    ids.add(item.item_id);
  }

  // Assets: declared ⇔ present, real type = declared type, hash and size as declared.
  const assetEntries = names.filter((n) => n.startsWith("assets/"));
  if (assetEntries.length > limits.max_assets || m.assets.length > limits.max_assets)
    return fail({ code: "too_many_assets" });
  const declared = new Map(m.assets.map((a) => [a.path, a]));
  const assetIssues: PackageIssue[] = [];
  const assets = new Map<string, { bytes: Uint8Array; type: AssetContentType }>();
  for (const path of assetEntries) {
    const spec = declared.get(path);
    if (!spec) {
      assetIssues.push({ code: "asset_undeclared", path });
      continue;
    }
    const data = files[path];
    const real = sniffImageType(data);
    if (real === null || real !== spec.type) assetIssues.push({ code: "asset_type_mismatch", path });
    else if (data.length !== spec.bytes || sha256Hex(data) !== spec.sha256)
      assetIssues.push({ code: "asset_sha256_mismatch", path });
    else assets.set(path, { bytes: data, type: real });
  }
  for (const path of declared.keys()) {
    if (!assetEntries.includes(path)) assetIssues.push({ code: "asset_missing", path });
  }
  if (assetIssues.length > 0) return fail(...assetIssues);

  // Plugin and schema.
  const resolved = options.resolvePlugin(m.plugin.id, m.plugin.schema_version);
  if (resolved === null) return fail({ code: "unknown_plugin", path: m.plugin.id });
  if (resolved === "unknown_schema_version")
    return fail({ code: "unknown_schema_version", path: String(m.plugin.schema_version) });
  const plugin = resolved;

  const draftMode = options.mode === "draft";
  const schemaIssues = draftMode ? [] : compileJsonSchema(plugin.content_schema)(c);
  if (schemaIssues.length > 0) {
    return fail(...schemaIssues.slice(0, 10).map((i) => ({ code: "schema_mismatch" as const, path: i.path })));
  }

  // Every image reference points at an asset of the package.
  const referenceIssues: PackageIssue[] = [];
  for (const item of draftMode ? [] : c.items) {
    const activity = plugin.activities.find((a) => a.id === item.activity);
    for (const field of activity?.fields ?? []) {
      if (field.type !== "image" || item.fields[field.key] === undefined) continue;
      const ref = FIELD_VALUE_SCHEMAS.image.safeParse(item.fields[field.key]);
      if (!ref.success || !assets.has(ref.data.asset)) {
        referenceIssues.push({ code: "asset_reference_missing", path: `${item.item_id}.${field.key}` });
      }
    }
  }
  if (referenceIssues.length > 0) return fail(...referenceIssues);

  if (contentSha256(c, m.assets) !== m.sha256) return fail({ code: "sha256_mismatch" });

  return { ok: true, package: { manifest: m, content: c, assets, fileSha256: sha256Hex(bytes), plugin } };
}

function isAllowedEntry(name: string): boolean {
  return name === "manifest.json" || name === "content.json" || ASSET_PATH_PATTERN.test(name);
}

function entryLimit(name: string, limits: PackageLimits): number {
  if (name.startsWith("assets/")) return limits.max_asset_bytes;
  if (name === "manifest.json") return MANIFEST_MAX_BYTES;
  return limits.max_bytes;
}

function safeJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/**
 * Reads only the plugin reference of a package's manifest, so the caller can
 * resolve the plugin definition (an async lookup) before running the full,
 * synchronous validation. Null when the bytes are not a readable package.
 */
export function peekPackagePlugin(bytes: Uint8Array): { id: string; schemaVersion: number } | null {
  try {
    const entries = listZipEntries(bytes);
    const manifest = entries.find((e) => e.name === "manifest.json");
    if (!manifest || manifest.uncompressedSize > MANIFEST_MAX_BYTES) return null;
    const files = readZipEntries(bytes, (name) => (name === "manifest.json" ? MANIFEST_MAX_BYTES : 0));
    const parsed = safeJson(files["manifest.json"]) as
      { plugin?: { id?: unknown; schema_version?: unknown } } | undefined;
    const id = parsed?.plugin?.id;
    const schemaVersion = parsed?.plugin?.schema_version;
    if (typeof id !== "string" || typeof schemaVersion !== "number") return null;
    return { id, schemaVersion };
  } catch {
    return null;
  }
}
