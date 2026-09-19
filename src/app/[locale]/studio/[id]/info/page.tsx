import { getTranslations, setRequestLocale } from "next-intl/server";
import { PluginInfoForm } from "@/components/studio/studio-forms";
import { Card } from "@/components/ui/card";
import { loadStudioPage } from "@/server/studio-page";

export default async function StudioInfoPage({ params }: PageProps<"/[locale]/studio/[id]/info">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin, editable }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio.info")]);
  return (
    <Card id="info" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {editable ? <PluginInfoForm pluginRowId={plugin.id} draft={plugin.draft} /> : null}
    </Card>
  );
}
