import { Sha256Hex, type PluginDefinition } from "./contract";
import { validateDefinition, type DefinitionIssue, type DefinitionLimits } from "./generate";
import { sha256OfJson } from "./hash";

/**
 * The file format of the platform's own reference plugins: one JSON file
 * (`plugins/core/<plugin_id>.lisanplugin.json`) whose `sha256` pins its
 * content, written by scripts/core-plugins.ts and turned into a seeding
 * migration by scripts/core-plugins-migration.mjs, so no migration is ever
 * written by hand for a plugin (ADR 0006 §12).
 *
 * Internal pipeline only. Members never import or export plugins or packages:
 * content moves through the community inside the platform (Ahmed, 2026-09-18,
 * decision R14), so no page, route or action exposes these functions.
 */

export const PORTABLE_EXTENSION = ".lisanplugin.json";

/** The hash a published version is pinned by; the player recomputes it before rendering. */
export function definitionSha256(definition: PluginDefinition): string {
  return sha256OfJson(definition);
}

export function exportDefinition(definition: PluginDefinition): string {
  return JSON.stringify({ ...definition, sha256: definitionSha256(definition) }, null, 2) + "\n";
}

export type ImportResult =
  | { ok: true; definition: PluginDefinition; sha256: string }
  | { ok: false; reason: "not_json" | "sha256_missing" | "sha256_mismatch" | "invalid"; issues?: DefinitionIssue[] };

export function importDefinition(text: string, limits: DefinitionLimits): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not_json" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "not_json" };

  const { sha256: declared, ...rest } = parsed as Record<string, unknown>;
  if (!Sha256Hex.safeParse(declared).success) return { ok: false, reason: "sha256_missing" };

  const validation = validateDefinition(rest, limits);
  if (!validation.ok) return { ok: false, reason: "invalid", issues: validation.issues };

  const actual = definitionSha256(validation.definition);
  if (actual !== declared) return { ok: false, reason: "sha256_mismatch" };
  return { ok: true, definition: validation.definition, sha256: actual };
}
