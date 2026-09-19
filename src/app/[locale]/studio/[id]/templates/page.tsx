import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { ActionForm } from "@/components/forms/action-form";
import { Card } from "@/components/ui/card";
import { removePluginTemplate } from "@/server/actions/studio";
import { loadStudioPage } from "@/server/studio-page";

/** Templates: the empty skeletons a creator starts a package from (decision R8). */
export default async function StudioTemplatesPage({ params }: PageProps<"/[locale]/studio/[id]/templates">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin, editable }, t] = await Promise.all([
    loadStudioPage(locale, id),
    getTranslations("studio.templates"),
  ]);
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const remove = removePluginTemplate.bind(null, locale);
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <Card id="templates" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {plugin.draft.templates.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {plugin.draft.templates.map((template) => (
            <li
              key={template.id}
              className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/studio/${id}/templates/${template.id}`} className={linkClass} dir="auto">
                  {template.name[uiLocale] || template.id}
                </Link>
                <code className="field-ltr rounded bg-surface px-1.5 text-xs text-ink-muted">{template.id}</code>
                <span className="text-xs text-ink-muted">{t("items", { count: template.items.length })}</span>
              </div>
              {editable ? (
                <ActionForm
                  action={remove}
                  messages="studio"
                  hidden={{ id: plugin.id, template: template.id }}
                  submitLabel={t("remove")}
                  variant="danger"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable && plugin.draft.activities.length > 0 ? (
        <div>
          <Link href={`/studio/${id}/templates/new`} className={linkClass}>
            {t("add")}
          </Link>
        </div>
      ) : null}
      {plugin.draft.activities.length === 0 ? <p className="text-sm text-ink-muted">{t("needActivity")}</p> : null}
    </Card>
  );
}
