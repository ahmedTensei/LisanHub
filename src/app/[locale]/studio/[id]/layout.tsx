import { getTranslations, setRequestLocale } from "next-intl/server";
import { isUiLocale } from "@/modules/account/ui-locales";
import { SectionNav, type SectionNavItem } from "@/components/section-nav";
import { Alert } from "@/components/ui/alert";
import { loadStudioPage } from "@/server/studio-page";

/** One plugin in the studio: its own sub-navigation over the sections of the definition. */
export default async function StudioPluginLayout({ children, params }: LayoutProps<"/[locale]/studio/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin, editable }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio")]);
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const name = plugin.draft.name[uiLocale] || plugin.draft.name.en || plugin.draft.name.ar || plugin.pluginId;

  const items: SectionNavItem[] = [
    { href: `/studio/${id}`, labelKey: "plugin.overview" },
    { href: `/studio/${id}/info`, labelKey: "plugin.info" },
    { href: `/studio/${id}/activities`, labelKey: "plugin.activities", badge: plugin.draft.activities.length },
    { href: `/studio/${id}/templates`, labelKey: "plugin.templates", badge: plugin.draft.templates.length },
    { href: `/studio/${id}/preview`, labelKey: "plugin.preview" },
    { href: `/studio/${id}/advanced`, labelKey: "plugin.advanced" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold" dir="auto">
          {name}
        </h2>
        <code className="field-ltr rounded bg-paper px-1.5 text-xs text-ink-muted">{plugin.pluginId}</code>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          {t(`status.${plugin.status}`)}
        </span>
      </header>
      {!editable ? (
        <Alert tone="error">
          <span>{t("plugin.disabledNotice")}</span>
          {plugin.disabledMessage[uiLocale] ? <span dir="auto">{plugin.disabledMessage[uiLocale]}</span> : null}
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <SectionNav namespace="studio" label={name} items={items} />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
