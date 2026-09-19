import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import Script from "next/script";
import { EXTENSION_GUARD_SCRIPT } from "@/components/extension-guard";
import { ExtensionGuardStop } from "@/components/extension-guard-stop";
import { IntlProvider } from "@/components/intl-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_TIME_ZONE } from "@/i18n/request";
import { localeDirection, routing } from "@/i18n/routing";
import "../globals.css";

/**
 * Arabic-first typeface with matching Latin glyphs, served from the repository
 * (src/app/fonts, SIL OFL 1.1): no request to Google Fonts at build or run time,
 * so the Arabic interface renders the same everywhere, including where that
 * network is slow or blocked (Ahmed, 2026-09-18).
 */
const plex = localFont({
  src: [
    { path: "../fonts/IBMPlexSansArabic-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/IBMPlexSansArabic-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/IBMPlexSansArabic-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/IBMPlexSansArabic-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Tahoma", "sans-serif"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={localeDirection(locale)} className={plex.variable} suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === "production" ? null : (
          // Development only: strips the attributes password-manager extensions inject before hydration.
          <Script id="extension-guard" strategy="beforeInteractive">
            {EXTENSION_GUARD_SCRIPT}
          </Script>
        )}
      </head>
      <body className="flex min-h-dvh flex-col antialiased" suppressHydrationWarning>
        <ExtensionGuardStop />
        <IntlProvider locale={locale} messages={messages} timeZone={DEFAULT_TIME_ZONE}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </IntlProvider>
      </body>
    </html>
  );
}
