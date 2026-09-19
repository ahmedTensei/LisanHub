import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreatePluginForm } from "@/components/studio/studio-forms";
import { Card } from "@/components/ui/card";

export default async function NewPluginPage({ params }: PageProps<"/[locale]/studio/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("studio.create");
  return (
    <Card id="new" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <CreatePluginForm />
    </Card>
  );
}
