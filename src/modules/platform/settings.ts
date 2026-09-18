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
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;

/**
 * How each setting is edited in the administration area (decision R6): a choice
 * among sensible values, never free text, except the optional support address.
 */
export type SettingField =
  { kind: "choice"; options: readonly number[] } | { kind: "boolean" } | { kind: "email"; optional: true };

export const SETTING_FIELDS: Record<PlatformSettingKey, SettingField> = {
  "moderation.escalation_open_reports": { kind: "choice", options: [1, 2, 3, 5, 10] },
  "lineage.derivation_notify_threshold": { kind: "choice", options: [1, 5, 10, 25, 50] },
  "quality.community_trusted_min_ratings": { kind: "choice", options: [5, 10, 20, 50] },
  "quality.community_trusted_min_average": { kind: "choice", options: [3, 3.5, 4, 4.5] },
  "founding.window_open": { kind: "boolean" },
  "support.email": { kind: "email", optional: true },
};

export function isPlatformSettingKey(value: unknown): value is PlatformSettingKey {
  return typeof value === "string" && value in SETTING_FIELDS;
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
