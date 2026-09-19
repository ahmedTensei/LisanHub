import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PackagePreview } from "@/components/editor/package-preview";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { loadContentPage } from "@/server/content-page";
import { loadPackage } from "@/server/packages/store";
import { playerUrlForRequest } from "@/server/player-origin";
import { getContentVersion } from "@/server/queries/content";
import { getPluginVersion, playabilityOf } from "@/server/queries/plugins";

/**
 * The creator sees the package as a learner would: the same sandboxed player
 * that S3 uses. `?version=<uuid>` previews a published version; the working
 * copy is shown by default.
 */
export default async function PackagePreviewPage({
  params,
  searchParams,
}: PageProps<"/[locale]/content/[id]/preview">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const [{ item }, t, playerUrl] = await Promise.all([
    loadContentPage(locale, id),
    getTranslations("editor.preview"),
    playerUrlForRequest(),
  ]);
  if (item.kind !== "package" || !item.packageKey || !item.pluginVersionId) notFound();

  const versionParam =
    typeof query.version === "string" && /^[0-9a-f-]{36}$/.test(query.version) ? query.version : null;
  const version = versionParam ? await getContentVersion(item.id, versionParam) : null;
  const key = version ? version.packageKey : item.packageKey;
  const [plugin, loaded] = await Promise.all([
    getPluginVersion(item.pluginVersionId),
    loadPackage(key, version ? "publish" : "draft"),
  ]);
  if (!plugin) notFound();
  const playable = playabilityOf(plugin, locale);

  return (
    <Card id="preview" title={version ? t("titleVersion", { n: version.versionNumber }) : t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {!playable.ok ? (
        <Alert tone="error">
          <span>{t(`paused.${playable.reason}`)}</span>
          {playable.message ? <span dir="auto">{playable.message}</span> : null}
        </Alert>
      ) : !loaded.ok ? (
        <Alert tone="error">{t("unreadable")}</Alert>
      ) : (
        <PackagePreview
          packageId={item.id}
          version={version ? version.id : "draft"}
          definition={plugin.definition}
          definitionSha256={plugin.sha256}
          items={loaded.package.content.items}
          playerUrl={playerUrl}
        />
      )}
    </Card>
  );
}
