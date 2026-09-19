import { getTranslations, setRequestLocale } from "next-intl/server";
import { TemplateEditor } from "@/components/studio/template-editor";
import { Card } from "@/components/ui/card";
import { loadStudioPage } from "@/server/studio-page";

export default async function NewTemplatePage({ params }: PageProps<"/[locale]/studio/[id]/templates/new">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio.template")]);
  return (
    <Card id="template" title={t("newTitle")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <TemplateEditor pluginRowId={plugin.id} activities={plugin.draft.activities} template={null} />
    </Card>
  );
}
