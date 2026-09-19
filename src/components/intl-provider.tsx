"use client";

import { IntlErrorCode, NextIntlClientProvider, type AbstractIntlMessages, type IntlError } from "next-intl";
import type { ReactNode } from "react";

/**
 * Client-side counterpart of the guard in src/i18n/request.ts: functions cannot
 * be inherited from the request configuration, so the provider is wrapped here
 * to fail loudly on a missing message outside production instead of showing a
 * raw key (Ahmed, 2026-09-18).
 */
function onError(error: IntlError) {
  if (error.code === IntlErrorCode.MISSING_MESSAGE && process.env.NODE_ENV !== "production") throw error;
  if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) return;
  console.error(error);
}

export function IntlProvider({
  locale,
  messages,
  timeZone,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone} onError={onError}>
      {children}
    </NextIntlClientProvider>
  );
}
