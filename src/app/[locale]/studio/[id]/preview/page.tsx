import { getTranslations, setRequestLocale } from "next-intl/server";
import { definitionSha256 } from "@/modules/plugins/portable";
import { StudioPreview } from "@/components/studio/studio-preview";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { playerUrlForRequest } from "@/server/player-origin";
import { getPluginLimits } from "@/server/queries/plugins";
import { validateStudioDraft } from "@/server/queries/studio";
import { loadStudioPage } from "@/server/studio-page";

/**
 * Preview in the sandboxed player with a throwaway item. This page has no
 * server action: nothing typed here is ever written to a table or a bucket.
 */
export default async function StudioPreviewPage({ params }: PageProps<"/[locale]/studio/[id]/preview">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ plugin }, t, limits, playerUrl] = await Promise.all([
    loadStudioPage(locale, id),
    getTranslations("studio.preview"),
    getPluginLimits(),
    playerUrlForRequest(),
  ]);
  const validation = validateStudioDraft(plugin.draft, limits);

  return (
    <Card id="preview" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {validation.ok ? (
        <StudioPreview
          definition={validation.definition}
          sha256={definitionSha256(validation.definition)}
          playerUrl={playerUrl}
        />
      ) : (
        <Alert tone="info">{t("fixFirst")}</Alert>
      )}
    </Card>
  );
}
