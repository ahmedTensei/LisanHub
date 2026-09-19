import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNav, type SectionNavItem } from "@/components/section-nav";
import { requireCapability } from "@/server/actor";

/**
 * "My content": the content creator's area (decision R7 — packages built on
 * plugins, and courses that order them). Students get a 404: there is no
 * publishing path for them anywhere.
 */
export default async function ContentLayout({ children, params }: LayoutProps<"/[locale]/content">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "content.create", `/${locale}/content`);
  const t = await getTranslations("editor");

  const items: SectionNavItem[] = [
    { href: "/content", labelKey: "nav.mine" },
    { href: "/content/new", labelKey: "nav.newPackage" },
    { href: "/content/new/course", labelKey: "nav.newCourse" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <SectionNav namespace="editor" label={t("title")} items={items} />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
