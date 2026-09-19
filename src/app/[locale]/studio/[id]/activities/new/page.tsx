import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActivityEditor } from "@/components/studio/activity-editor";
import { Card } from "@/components/ui/card";
import { loadStudioPage } from "@/server/studio-page";

export default async function NewActivityPage({ params }: PageProps<"/[locale]/studio/[id]/activities/new">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio.activity")]);
  return (
    <Card id="activity" title={t("newTitle")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <ActivityEditor pluginRowId={plugin.id} activity={null} />
    </Card>
  );
}
