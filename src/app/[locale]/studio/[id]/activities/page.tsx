import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { ActionForm } from "@/components/forms/action-form";
import { Card } from "@/components/ui/card";
import { movePluginActivity, removePluginActivity } from "@/server/actions/studio";
import { loadStudioPage } from "@/server/studio-page";

/** The activities of the plugin: the kinds of items a package may contain. */
export default async function StudioActivitiesPage({ params }: PageProps<"/[locale]/studio/[id]/activities">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin, editable }, t, tTypes, tEval] = await Promise.all([
    loadStudioPage(locale, id),
    getTranslations("studio.activities"),
    getTranslations("studio.fieldTypes"),
    getTranslations("studio.activity.evaluators"),
  ]);
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const move = movePluginActivity.bind(null, locale);
  const remove = removePluginActivity.bind(null, locale);
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <Card id="activities" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {plugin.draft.activities.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {plugin.draft.activities.map((activity) => (
            <li
              key={activity.id}
              className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/studio/${id}/activities/${activity.id}`} className={linkClass} dir="auto">
                  {activity.name[uiLocale] || activity.id}
                </Link>
                <code className="field-ltr rounded bg-surface px-1.5 text-xs text-ink-muted">{activity.id}</code>
                <span className="text-xs text-ink-muted">{tEval(activity.scoring.evaluator)}</span>
              </div>
              <p className="flex flex-wrap gap-1 text-xs">
                {activity.fields.map((f) => (
                  <span key={f.key} className="rounded-full bg-surface px-2 py-0.5 text-ink-muted">
                    <span className="field-ltr">{f.key}</span> · {tTypes(f.type)}
                    {f.key === activity.graded_field ? " ✓" : ""}
                  </span>
                ))}
              </p>
              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <ActionForm
                    action={move}
                    messages="studio"
                    hidden={{ id: plugin.id, activity: activity.id, direction: "up" }}
                    submitLabel={t("moveUp")}
                  />
                  <ActionForm
                    action={move}
                    messages="studio"
                    hidden={{ id: plugin.id, activity: activity.id, direction: "down" }}
                    submitLabel={t("moveDown")}
                  />
                  <ActionForm
                    action={remove}
                    messages="studio"
                    hidden={{ id: plugin.id, activity: activity.id }}
                    submitLabel={t("remove")}
                    variant="danger"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {editable ? (
        <div>
          <Link href={`/studio/${id}/activities/new`} className={linkClass}>
            {t("add")}
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
