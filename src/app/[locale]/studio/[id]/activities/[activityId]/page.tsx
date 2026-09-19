import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ActivityEditor } from "@/components/studio/activity-editor";
import { Card } from "@/components/ui/card";
import { loadStudioPage } from "@/server/studio-page";

export default async function EditActivityPage({ params }: PageProps<"/[locale]/studio/[id]/activities/[activityId]">) {
  const { locale, id, activityId } = await params;
  setRequestLocale(locale);
  const [{ plugin }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio.activity")]);
  const activity = plugin.draft.activities.find((a) => a.id === activityId);
  if (!activity) notFound();
  return (
    <Card id="activity" title={t("editTitle", { id: activity.id })}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <ActivityEditor pluginRowId={plugin.id} activity={activity} />
    </Card>
  );
}
