const KB = 1024;
const MB = 1024 * KB;

/**
 * Keys and defaults of `public.platform_settings`. Values are changed by
 * administration at runtime; these defaults only apply when a key is missing.
 * There are no commercial settings until the final stage (decision R2).
 */
export const PLATFORM_SETTING_DEFAULTS = {
  "moderation.escalation_open_reports": 3,
  "lineage.derivation_notify_threshold": 10,
  "quality.community_trusted_min_ratings": 10,
  "quality.community_trusted_min_average": 4,
  "founding.window_open": true,
  "support.email": "",
  // Package and plugin limits (decision R7): settings, never constants in code.
  "packages.max_bytes": 10 * MB,
  "packages.max_items": 200,
  "packages.max_assets": 50,
  "packages.max_asset_bytes": 1 * MB,
  "plugins.max_templates": 10,
  "plugins.max_definition_bytes": 256 * KB,
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;

/**
 * How each setting is edited in the administration area (decision R6): a choice
 * among sensible values, never free text, except the optional support address.
 */
export type SettingField =
  | { kind: "choice"; options: readonly number[]; unit?: "bytes" }
  | { kind: "boolean" }
  | { kind: "email"; optional: true };

export const SETTING_FIELDS: Record<PlatformSettingKey, SettingField> = {
  "moderation.escalation_open_reports": { kind: "choice", options: [1, 2, 3, 5, 10] },
  "lineage.derivation_notify_threshold": { kind: "choice", options: [1, 5, 10, 25, 50] },
  "quality.community_trusted_min_ratings": { kind: "choice", options: [5, 10, 20, 50] },
  "quality.community_trusted_min_average": { kind: "choice", options: [3, 3.5, 4, 4.5] },
  "founding.window_open": { kind: "boolean" },
  "support.email": { kind: "email", optional: true },
  "packages.max_bytes": { kind: "choice", options: [2 * MB, 5 * MB, 10 * MB, 20 * MB], unit: "bytes" },
  "packages.max_items": { kind: "choice", options: [50, 100, 200, 500] },
  "packages.max_assets": { kind: "choice", options: [10, 20, 50, 100] },
  "packages.max_asset_bytes": { kind: "choice", options: [256 * KB, 512 * KB, 1 * MB, 2 * MB], unit: "bytes" },
  "plugins.max_templates": { kind: "choice", options: [3, 5, 10, 20] },
  "plugins.max_definition_bytes": { kind: "choice", options: [64 * KB, 128 * KB, 256 * KB, 512 * KB], unit: "bytes" },
};

/** How a choice is shown to administration: bytes become "512 KB" / "2 MB". */
export function formatSettingOption(field: SettingField, value: number): string {
  if (field.kind === "choice" && field.unit === "bytes") {
    return value >= MB ? `${value / MB} MB` : `${Math.round(value / KB)} KB`;
  }
  return String(value);
}

/** The limits the package validator and the studio read from settings (with the defaults as fallback). */
export interface PackageLimits {
  max_bytes: number;
  max_items: number;
  max_assets: number;
  max_asset_bytes: number;
}

export interface PluginLimits {
  max_templates: number;
  max_definition_bytes: number;
}

export function packageLimitsFrom(values: Partial<Record<PlatformSettingKey, unknown>>): PackageLimits {
  const n = (key: PlatformSettingKey) => {
    const v = values[key];
    return typeof v === "number" && Number.isFinite(v) ? v : (PLATFORM_SETTING_DEFAULTS[key] as number);
  };
  return {
    max_bytes: n("packages.max_bytes"),
    max_items: n("packages.max_items"),
    max_assets: n("packages.max_assets"),
    max_asset_bytes: n("packages.max_asset_bytes"),
  };
}

export function pluginLimitsFrom(values: Partial<Record<PlatformSettingKey, unknown>>): PluginLimits {
  const n = (key: PlatformSettingKey) => {
    const v = values[key];
    return typeof v === "number" && Number.isFinite(v) ? v : (PLATFORM_SETTING_DEFAULTS[key] as number);
  };
  return { max_templates: n("plugins.max_templates"), max_definition_bytes: n("plugins.max_definition_bytes") };
}

export function isPlatformSettingKey(value: unknown): value is PlatformSettingKey {
  return typeof value === "string" && value in SETTING_FIELDS;
}

/**
 * The message key under `admin.settings.fields` that labels a setting. Setting
 * keys carry dots (`packages.max_bytes`) and message keys never do (dots are
 * namespace separators), so each dot becomes an underscore. Kept here, next to
 * the catalogue, so src/i18n/message-catalogue.test.ts proves every setting's
 * label, description and options exist in the three catalogues.
 */
export function settingMessageKey(key: PlatformSettingKey): string {
  return key.replace(/\./g, "_");
}

/**
 * Turns what the form sent into the stored JSON value, or null when the
 * submission is not one of the allowed options.
 */
export function parseSettingValue(key: PlatformSettingKey, raw: string): number | boolean | string | null {
  const field = SETTING_FIELDS[key];
  switch (field.kind) {
    case "choice": {
      const n = Number(raw);
      return field.options.includes(n) ? n : null;
    }
    case "boolean":
      return raw === "true" ? true : raw === "false" ? false : null;
    case "email": {
      const value = raw.trim();
      if (value === "") return "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254 ? value : null;
    }
  }
}

export type FeatureKey = "registration" | "publishing" | "community_chat" | "product_feedback" | "maintenance_mode";

export type FeatureMode = "enabled" | "create_disabled" | "read_only" | "disabled";

/** The modes that make sense for each switch; anything else is refused (decision R6). */
export const FEATURE_MODES: Record<FeatureKey, readonly FeatureMode[]> = {
  registration: ["enabled", "disabled"],
  publishing: ["enabled", "create_disabled"],
  community_chat: ["enabled", "read_only", "disabled"],
  product_feedback: ["enabled", "disabled"],
  maintenance_mode: ["disabled", "enabled"],
};

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && value in FEATURE_MODES;
}

export function isAllowedMode(key: FeatureKey, mode: unknown): mode is FeatureMode {
  return typeof mode === "string" && (FEATURE_MODES[key] as readonly string[]).includes(mode);
}

export function allowsCreation(mode: FeatureMode): boolean {
  return mode === "enabled";
}

export function allowsReading(mode: FeatureMode): boolean {
  return mode !== "disabled";
}
