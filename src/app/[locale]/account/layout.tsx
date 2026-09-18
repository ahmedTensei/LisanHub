import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNav } from "@/components/section-nav";
import { requireUser } from "@/server/actor";

/** Account settings shell: one place for everything about the member's own account. */
export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account`);
  const t = await getTranslations("account");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span dir="auto">{session.displayName}</span>
          <span dir="ltr">@{session.username}</span>
          <span>·</span>
          <span dir="ltr">{session.email}</span>
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <SectionNav
          namespace="account.nav"
          label={t("title")}
          items={[
            { href: "/account", labelKey: "profile" },
            { href: "/account/languages", labelKey: "languages" },
            { href: "/account/preferences", labelKey: "preferences" },
            { href: "/account/security", labelKey: "security" },
            { href: "/account/advanced", labelKey: "advanced" },
            { href: "/account/notifications", labelKey: "notifications", soon: "S4" },
            { href: "/account/data", labelKey: "data", soon: "S6" },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
