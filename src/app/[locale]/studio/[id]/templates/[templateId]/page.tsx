import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TemplateEditor } from "@/components/studio/template-editor";
import { Card } from "@/components/ui/card";
import { loadStudioPage } from "@/server/studio-page";

export default async function EditTemplatePage({ params }: PageProps<"/[locale]/studio/[id]/templates/[templateId]">) {
  const { locale, id, templateId } = await params;
  setRequestLocale(locale);
  const [{ plugin }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio.template")]);
  const template = plugin.draft.templates.find((x) => x.id === templateId);
  if (!template) notFound();
  return (
    <Card id="template" title={t("editTitle", { id: template.id })}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <TemplateEditor pluginRowId={plugin.id} activities={plugin.draft.activities} template={template} />
    </Card>
  );
}
