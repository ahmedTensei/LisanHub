import { getTranslations, setRequestLocale } from "next-intl/server";
import { localizedTitle } from "@/modules/content/package-input";
import { SectionNav, type SectionNavItem } from "@/components/section-nav";
import { Alert } from "@/components/ui/alert";
import { loadContentPage } from "@/server/content-page";

/** One package or course: sub-navigation over editing, preview, history and download. */
export default async function ContentItemLayout({ children, params }: LayoutProps<"/[locale]/content/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ item, editable }, t, tStatus] = await Promise.all([
    loadContentPage(locale, id),
    getTranslations("editor"),
    getTranslations("editor.statuses"),
  ]);

  const items: SectionNavItem[] = [{ href: `/content/${id}`, labelKey: "item.edit" }];
  if (item.kind === "package") {
    items.push(
      { href: `/content/${id}/preview`, labelKey: "item.preview" },
      { href: `/content/${id}/history`, labelKey: "item.history" },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold" dir="auto">
          {item.title}
        </h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          {tStatus(item.status)}
        </span>
        {item.plugin ? (
          <code className="field-ltr rounded bg-paper px-1.5 text-xs text-ink-muted">{item.plugin.pluginId}</code>
        ) : null}
      </header>
      {item.moderationNote ? (
        <Alert tone="error">{t("item.hiddenByModeration", { reason: item.moderationNote })}</Alert>
      ) : !editable ? (
        <Alert tone="error">{t("item.underModeration")}</Alert>
      ) : null}
      {item.plugin?.disabled ? <Alert tone="error">{t("item.pluginPaused")}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <SectionNav namespace="editor" label={localizedTitle(item, locale)} items={items} />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
