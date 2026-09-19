import { hasLocale, IntlErrorCode, type IntlError } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * A missing message must never reach the screen as a raw key such as
 * "admin.settings.fields.x.label" (Ahmed, 2026-09-18). Outside production the
 * page fails loudly instead, so the mistake is seen while developing; in
 * production next-intl's fallback (the key) is kept, because a broken label is
 * still better than a broken page for a member.
 */
function onError(error: IntlError) {
  if (error.code === IntlErrorCode.MISSING_MESSAGE && process.env.NODE_ENV !== "production") throw error;
  if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) return;
  console.error(error);
}

/**
 * One time zone for every rendered date, so server and client markup agree
 * (next-intl ENVIRONMENT_FALLBACK). Algeria is the platform's home (CLAUDE.md);
 * a per-member time zone can replace it from the preferences page later.
 */
export const DEFAULT_TIME_ZONE = "Africa/Algiers";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: DEFAULT_TIME_ZONE,
    onError,
  };
});
