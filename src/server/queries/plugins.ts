import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PluginDefinition as Definition } from "@/modules/plugins/contract";
import type { LocaleText } from "@/modules/plugins/fields";
import { loadDefinition } from "@/server/plugins/store";
import { authorable, playability, type Playability } from "@/modules/plugins/playable";
import {
  packageLimitsFrom,
  pluginLimitsFrom,
  type PackageLimits,
  type PlatformSettingKey,
  type PluginLimits,
} from "@/modules/platform/settings";

/**
 * Reads about plugins shared by the studio, the content editor and the
 * player. Definitions are data: files in the store named by the rows
 * (decision R13), verified against the row's hash on every read, never imported.
 */

async function readSettings(
  keys: readonly PlatformSettingKey[],
): Promise<Partial<Record<PlatformSettingKey, unknown>>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", [...keys]);
  if (error) throw new Error(`settings: ${error.message}`);
  return Object.fromEntries(data.map((row) => [row.key, row.value])) as Partial<Record<PlatformSettingKey, unknown>>;
}

export async function getPluginLimits(): Promise<PluginLimits> {
  return pluginLimitsFrom(await readSettings(["plugins.max_templates", "plugins.max_definition_bytes"]));
}

export async function getPackageLimits(): Promise<PackageLimits> {
  return packageLimitsFrom(
    await readSettings(["packages.max_bytes", "packages.max_items", "packages.max_assets", "packages.max_asset_bytes"]),
  );
}

export interface PluginVersionView {
  versionId: string;
  pluginRowId: string;
  pluginId: string;
  version: string;
  schemaVersion: number;
  definition: Definition;
  sha256: string;
  versionDisabled: boolean;
  plugin: {
    status: "draft" | "pending_review" | "published" | "hidden";
    disabled: boolean;
    disabledMessage: Record<string, string>;
    ownerId: string | null;
  };
}

function messageMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

/** A published version with its plugin's kill-switch state; null when invisible to the caller. */
export async function getPluginVersion(versionId: string): Promise<PluginVersionView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugin_versions")
    .select(
      // Two relationships link the tables (plugin_id and current_version_id): the parent is named explicitly.
      "id, plugin_id, version, schema_version, definition_key, definition_sha256, disabled, plugins!plugin_versions_plugin_id_fkey!inner(id, plugin_id, status, disabled, disabled_message, owner_id)",
    )
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`plugin version: ${error.message}`);
  if (!data) return null;
  const plugin = data.plugins;
  // A version whose file is missing or does not hash to its row is unavailable, never rendered unpinned.
  const definition = await loadDefinition(data.definition_key, data.definition_sha256);
  if (!definition) return null;
  return {
    versionId: data.id,
    pluginRowId: plugin.id,
    pluginId: plugin.plugin_id,
    version: data.version,
    schemaVersion: data.schema_version,
    definition,
    sha256: data.definition_sha256,
    versionDisabled: data.disabled,
    plugin: {
      status: plugin.status,
      disabled: plugin.disabled,
      disabledMessage: messageMap(plugin.disabled_message),
      ownerId: plugin.owner_id,
    },
  };
}

export function playabilityOf(view: PluginVersionView, locale: string): Playability {
  return playability(view.plugin, { disabled: view.versionDisabled }, locale);
}

export interface CatalogueEntry {
  pluginRowId: string;
  pluginId: string;
  versionId: string;
  version: string;
  schemaVersion: number;
  name: LocaleText;
  description: LocaleText;
  activities: number;
  templates: number;
  definition: Definition;
  sha256: string;
  ownerId: string | null;
}

/** Plugins a Content Creator may build on: published, not disabled, with their current version. */
export async function listCatalogue(): Promise<CatalogueEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugins")
    .select(
      "id, plugin_id, status, disabled, owner_id, current_version_id, plugin_versions!plugins_current_version_fk(id, version, schema_version, definition_key, definition_sha256, disabled)",
    )
    .eq("status", "published")
    .eq("disabled", false)
    .not("current_version_id", "is", null)
    .order("plugin_id");
  if (error) throw new Error(`catalogue: ${error.message}`);

  const entries: CatalogueEntry[] = [];
  for (const row of data) {
    const version = row.plugin_versions;
    if (!version || version.disabled) continue;
    if (!authorable({ status: row.status, disabled: row.disabled, disabledMessage: {} })) continue;
    const definition = await loadDefinition(version.definition_key, version.definition_sha256);
    if (!definition) continue;
    entries.push({
      pluginRowId: row.id,
      pluginId: row.plugin_id,
      versionId: version.id,
      version: version.version,
      schemaVersion: version.schema_version,
      name: definition.name,
      description: definition.description,
      activities: definition.activities.length,
      templates: definition.templates.length,
      definition,
      sha256: version.definition_sha256,
      ownerId: row.owner_id,
    });
  }
  return entries;
}

/**
 * The published definition a package must validate against: the plugin's
 * current version when its schema_version matches. Used by the package validator.
 */
export async function resolvePublishedDefinition(
  pluginId: string,
  schemaVersion: number,
): Promise<{ definition: Definition; versionId: string } | null | "unknown_schema_version"> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plugins")
    .select("id, plugin_versions!plugins_current_version_fk(id, schema_version, definition_key, definition_sha256)")
    .eq("plugin_id", pluginId)
    .in("status", ["published", "hidden"])
    .maybeSingle();
  if (error) throw new Error(`resolve plugin: ${error.message}`);
  if (!data?.plugin_versions) return null;
  const version = data.plugin_versions;
  if (version.schema_version !== schemaVersion) return "unknown_schema_version";
  const definition = await loadDefinition(version.definition_key, version.definition_sha256);
  if (!definition) return null;
  return { definition, versionId: version.id };
}
