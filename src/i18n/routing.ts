import { defineRouting } from "next-intl/routing";
import { DEFAULT_UI_LOCALE, UI_LOCALES } from "@/modules/account/ui-locales";

/**
 * Interface languages at launch. This list is about the UI only; learning content
 * languages come from the ISO 639-3 table and are never limited by it.
 * The final launch set is decision Q6 (docs/decisions/open-decisions.md).
 */
export const routing = defineRouting({
  locales: UI_LOCALES,
  defaultLocale: DEFAULT_UI_LOCALE,
});

export type AppLocale = (typeof routing.locales)[number];

const RTL_LOCALES = new Set(["ar", "fa", "he", "ur", "ps", "ckb", "ug", "yi", "dv"]);

export function localeDirection(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale.split("-")[0]) ? "rtl" : "ltr";
}
