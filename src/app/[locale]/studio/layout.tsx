import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNav, type SectionNavItem } from "@/components/section-nav";
import { requireCapability } from "@/server/actor";

/**
 * The Plugin Studio (decisions R7 and R10): a standalone area for
 * Contributors and the Platform Owner, with its own navigation — not part of
 * the administration area. Students and Content Creators get a 404.
 */
export default async function StudioLayout({ children, params }: LayoutProps<"/[locale]/studio">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "plugins.author", `/${locale}/studio`);
  const t = await getTranslations("studio");

  const items: SectionNavItem[] = [
    { href: "/studio", labelKey: "nav.mine" },
    { href: "/studio/new", labelKey: "nav.new" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <SectionNav namespace="studio" label={t("title")} items={items} />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
