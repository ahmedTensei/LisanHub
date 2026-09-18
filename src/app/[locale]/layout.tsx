import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Script from "next/script";
import { EXTENSION_GUARD_SCRIPT } from "@/components/extension-guard";
import { ExtensionGuardStop } from "@/components/extension-guard-stop";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { localeDirection, routing } from "@/i18n/routing";
import "../globals.css";

/** Arabic-first typeface with matching Latin glyphs; self-hosted by next/font at build time. */
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
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
        <NextIntlClientProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
