/**
 * Interface languages available at launch (decision Q6 keeps the final set open).
 * This is the UI only: learning languages come from the ISO 639-3 table and are
 * never limited by this list (i18n-rtl). `src/i18n/routing.ts` consumes it.
 */
export const UI_LOCALES = ["ar", "fr", "en"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const DEFAULT_UI_LOCALE: UiLocale = "ar";

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && (UI_LOCALES as readonly string[]).includes(value);
}
