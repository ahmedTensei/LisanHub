import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CreatePackageForm, type PluginChoice } from "@/components/editor/content-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/actor";
import { listLanguagePairs } from "@/server/queries/account";
import { listCatalogue } from "@/server/queries/plugins";

/** A new package: a plugin from the catalogue, one of the creator's language pairs, a starting template, a title. */
export default async function NewPackagePage({ params }: PageProps<"/[locale]/content/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations("editor.create"), getSession()]);
  if (session.actor.kind !== "user") return null;
  const [catalogue, pairs] = await Promise.all([listCatalogue(), listLanguagePairs(session.actor.userId)]);
  const plugins: PluginChoice[] = catalogue.map((c) => ({
    versionId: c.versionId,
    pluginId: c.pluginId,
    name: c.name,
    description: c.description,
    templates: c.definition.templates.map((tpl) => ({ id: tpl.id, name: tpl.name, description: tpl.description })),
  }));
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <Card id="new" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {plugins.length === 0 ? <Alert tone="info">{t("noPlugins")}</Alert> : null}
      {pairs.length === 0 ? (
        <Alert tone="info">
          <span>{t("noPairs")}</span>
          <Link href="/account/languages" className={linkClass}>
            {t("addPair")}
          </Link>
        </Alert>
      ) : null}
      <CreatePackageForm
        plugins={plugins}
        pairs={pairs.map((p) => ({
          id: p.id,
          label: `${p.native.name} → ${p.target.name}${p.dialect ? ` (${p.dialect})` : ""}`,
        }))}
      />
    </Card>
  );
}
