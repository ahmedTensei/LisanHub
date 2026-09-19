import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { generateAuthoringFields } from "@/modules/plugins/generate";
import { ContentItemEditor } from "@/components/editor/content-item-editor";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { loadContentPage } from "@/server/content-page";
import { loadPackage } from "@/server/packages/store";
import { getPluginVersion } from "@/server/queries/plugins";

/** One item of the working copy, edited through the form generated from the plugin's authoring fields. */
export default async function ContentItemEditPage({ params }: PageProps<"/[locale]/content/[id]/items/[itemId]">) {
  const { locale, id, itemId } = await params;
  setRequestLocale(locale);
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const [{ item, editable }, t] = await Promise.all([
    loadContentPage(locale, id),
    getTranslations("editor.itemEditor"),
  ]);
  if (item.kind !== "package" || !item.packageKey || !item.pluginVersionId) notFound();
  const [plugin, draft] = await Promise.all([
    getPluginVersion(item.pluginVersionId),
    loadPackage(item.packageKey, "draft"),
  ]);
  if (!plugin || !draft.ok) notFound();
  const entry = draft.package.content.items.find((i) => i.item_id === itemId);
  if (!entry) notFound();
  const authoring = generateAuthoringFields(plugin.definition.activities).find((a) => a.activity === entry.activity);
  if (!authoring) notFound();
  const index = draft.package.content.items.findIndex((i) => i.item_id === itemId);
  const assets = [...draft.package.assets.keys()].map((path) => ({ path, label: path.replace(/^assets\//, "") }));

  return (
    <Card id="item" title={t("title", { n: index + 1, activity: authoring.name[uiLocale] || authoring.activity })}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {!editable ? <Alert tone="error">{t("readOnly")}</Alert> : null}
      {editable ? (
        <ContentItemEditor
          packageId={item.id}
          itemId={entry.item_id}
          activity={authoring}
          initialFields={entry.fields}
          initialSkill={entry.skill}
          assets={assets}
        />
      ) : null}
      <Link
        href={`/content/${item.id}`}
        className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        {t("backToPackage")}
      </Link>
    </Card>
  );
}
