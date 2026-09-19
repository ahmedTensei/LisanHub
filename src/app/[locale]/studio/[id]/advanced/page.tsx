import { getTranslations, setRequestLocale } from "next-intl/server";
import { generateContentSchema } from "@/modules/plugins/generate";
import { AdvancedSchemaForm } from "@/components/studio/studio-forms";
import { Card } from "@/components/ui/card";
import { loadStudioPage } from "@/server/studio-page";

/** The advanced escape hatch: read the generated schema; paste one by hand only inside the collapsed section. */
export default async function StudioAdvancedPage({ params }: PageProps<"/[locale]/studio/[id]/advanced">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin, editable }, t] = await Promise.all([loadStudioPage(locale, id), getTranslations("studio.advanced")]);
  const generated = generateContentSchema(plugin.draft.activities);
  return (
    <Card id="advanced" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <details className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t("generatedTitle")}</summary>
        <pre className="field-ltr mt-3 max-h-96 overflow-auto rounded bg-surface p-3 text-xs">
          {JSON.stringify(generated, null, 2)}
        </pre>
      </details>
      {editable ? (
        <details className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
          <summary className="cursor-pointer text-sm font-semibold">{t("customTitle")}</summary>
          <div className="mt-3">
            <AdvancedSchemaForm pluginRowId={plugin.id} draft={plugin.draft} />
          </div>
        </details>
      ) : null}
    </Card>
  );
}
