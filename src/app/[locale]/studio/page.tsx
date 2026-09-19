import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/actor";
import { listStudioPlugins } from "@/server/queries/studio";

const NOTICES = ["contributor", "deleted"] as const;

/** "My plugins": every definition this member is building or has published; an honest empty state otherwise. */
export default async function StudioHome({ params, searchParams }: PageProps<"/[locale]/studio">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const notice = NOTICES.find((n) => n === query.notice);
  const [t, session] = await Promise.all([getTranslations("studio"), getSession()]);
  const plugins = await listStudioPlugins(session.actor);
  const uiLocale = isUiLocale(locale) ? locale : "ar";

  return (
    <Card id="mine" title={t("mine.title")}>
      {notice ? <Alert tone="success">{t(`notices.${notice}`)}</Alert> : null}
      {plugins.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center">
          <p className="text-sm text-ink-muted">{t("mine.empty")}</p>
          <div>
            <Link href="/studio/new" className="font-semibold text-accent underline-offset-4 hover:underline">
              {t("mine.createFirst")}
            </Link>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {plugins.map((plugin) => (
            <li key={plugin.id}>
              <Link
                href={`/studio/${plugin.id}`}
                className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-paper p-4 hover:border-line-strong"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold" dir="auto">
                    {plugin.draft.name[uiLocale] || plugin.draft.name.en || plugin.draft.name.ar || plugin.pluginId}
                  </span>
                  <code className="field-ltr rounded bg-surface px-1.5 text-xs text-ink-muted">{plugin.pluginId}</code>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {t(`status.${plugin.status}`)}
                  </span>
                  {plugin.disabled ? (
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                      {t("status.disabled")}
                    </span>
                  ) : null}
                  {plugin.ownerId === null ? (
                    <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">
                      {t("mine.platformPlugin")}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-ink-muted">
                  {t("mine.activities", { count: plugin.draft.activities.length })} ·{" "}
                  {t("mine.templates", { count: plugin.draft.templates.length })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
