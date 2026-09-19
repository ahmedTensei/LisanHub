/**
 * The kill switch (ADR 0006 §9): a disabled plugin or version blocks
 * authoring and playback at once, with a translated message, and leaves every
 * package untouched. Reading the flags is the platform's job; this decides.
 */

export interface PluginState {
  status: "draft" | "pending_review" | "published" | "hidden";
  disabled: boolean;
  disabledMessage: Record<string, string>;
}

export interface PluginVersionState {
  disabled: boolean;
}

export const PLAYABILITY_REASONS = ["plugin_disabled", "version_disabled", "plugin_not_published"] as const;
export type PlayabilityReason = (typeof PLAYABILITY_REASONS)[number];

export type Playability = { ok: true } | { ok: false; reason: PlayabilityReason; message: string | null };

/**
 * Whether a package built on this plugin version may be rendered. A hidden
 * plugin still plays (it is only out of the catalogue); a draft never does.
 */
export function playability(plugin: PluginState, version: PluginVersionState, locale: string): Playability {
  if (plugin.disabled) return { ok: false, reason: "plugin_disabled", message: plugin.disabledMessage[locale] ?? null };
  if (version.disabled) return { ok: false, reason: "version_disabled", message: null };
  if (plugin.status !== "published" && plugin.status !== "hidden") {
    return { ok: false, reason: "plugin_not_published", message: null };
  }
  return { ok: true };
}

/** Whether a creator may start or continue a package on this plugin (the catalogue hides hidden ones). */
export function authorable(plugin: PluginState): boolean {
  return !plugin.disabled && plugin.status === "published";
}
