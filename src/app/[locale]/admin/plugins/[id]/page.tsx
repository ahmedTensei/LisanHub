import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { definitionSha256 } from "@/modules/plugins/portable";
import { StudioPreview } from "@/components/studio/studio-preview";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireCapability } from "@/server/actor";
import { playerUrlForRequest } from "@/server/player-origin";
import { getPluginLimits, getPluginVersion } from "@/server/queries/plugins";
import { getStudioPlugin, listPluginRequests, listPluginVersions, validateStudioDraft } from "@/server/queries/studio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * One plugin under review or oversight (decisions R10, R17): its activities
 * and fields, its versions and requests, and a live preview in the sandboxed
 * player so a reviewer sees how it behaves before approving it. The kill
 * switch and hiding stay on the plugins page; nothing here edits the plugin.
 */
export default async function AdminPluginPage({ params }: PageProps<"/[locale]/admin/plugins/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "plugins.review", `/${locale}/admin/plugins/${id}`);
  if (!UUID.test(id)) notFound();
  const [t, tStatus, tTypes, tEvaluators, format, limits, playerUrl, plugin] = await Promise.all([
    getTranslations("admin.pluginDetail"),
    getTranslations("studio.status"),
    getTranslations("studio.fieldTypes"),
    getTranslations("studio.activity.evaluators"),
    getFormatter(),
    getPluginLimits(),
    playerUrlForRequest(),
    getStudioPlugin(id),
  ]);
  if (!plugin) notFound();
  const [versions, requests, current] = await Promise.all([
    listPluginVersions(id),
    listPluginRequests(id),
    plugin.currentVersionId ? getPluginVersion(plugin.currentVersionId) : Promise.resolve(null),
  ]);
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const draftValidation = validateStudioDraft(plugin.draft, limits);
  // Reviewers look at what is asked of them: the draft when a request is pending, the published version otherwise.
  const pendingRequest = requests.find((r) => r.status === "pending") ?? null;
  const shown =
    pendingRequest && draftValidation.ok
      ? {
          definition: draftValidation.definition,
          sha256: definitionSha256(draftValidation.definition),
          source: "draft" as const,
        }
      : current
        ? { definition: current.definition, sha256: current.sha256, source: "published" as const }
        : draftValidation.ok
          ? {
              definition: draftValidation.definition,
              sha256: definitionSha256(draftValidation.definition),
              source: "draft" as const,
            }
          : null;
  const name = shown?.definition.name[uiLocale] || shown?.definition.name.en || plugin.pluginId;
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <div className="flex flex-col gap-6">
      <Card id="plugin" title={name}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <code className="field-ltr rounded bg-paper px-1.5 text-xs text-ink-muted">{plugin.pluginId}</code>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
            {tStatus(plugin.status)}
          </span>
          {plugin.disabled ? (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
              {tStatus("disabled")}
            </span>
          ) : null}
          <span className="text-xs text-ink-muted">{plugin.ownerId ? t("communityPlugin") : t("platformPlugin")}</span>
        </div>
        {shown ? (
          <p className="text-sm text-ink-muted" dir="auto">
            {shown.definition.description[uiLocale] || shown.definition.description.en}
          </p>
        ) : null}
        <p className="text-sm">
          <Link href="/admin/plugins" className={linkClass}>
            {t("backToModeration")}
          </Link>
        </p>
      </Card>

      {shown ? (
        <Card id="activities" title={t("activitiesTitle", { count: shown.definition.activities.length })}>
          <p className="text-xs text-ink-muted">
            {shown.source === "draft" ? t("showingDraft") : t("showingPublished")}
          </p>
          <ul className="flex flex-col gap-3 text-sm">
            {shown.definition.activities.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold" dir="auto">
                    {activity.name[uiLocale] || activity.name.en || activity.id}
                  </span>
                  <code className="field-ltr text-xs text-ink-muted">{activity.id}</code>
                  <span className="text-xs text-ink-muted">
                    {t("scoring")}: {tEvaluators(activity.scoring.evaluator)}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2 text-xs text-ink-muted">
                  {activity.fields.map((field) => (
                    <li key={field.key} className="rounded-full bg-paper px-2 py-0.5">
                      <span dir="auto">{field.label[uiLocale] || field.label.en || field.key}</span> ·{" "}
                      {tTypes(field.type)}
                      {field.key === activity.graded_field ? ` · ${t("graded")}` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            {t("templatesCount", { count: shown.definition.templates.length })} ·{" "}
            {t("assetsAllowed", { kinds: shown.definition.assets_allowed.join(", ") || "—" })} ·{" "}
            <code className="field-ltr">{shown.sha256.slice(0, 12)}…</code>
          </p>
        </Card>
      ) : (
        <Alert tone="info">{t("draftInvalid")}</Alert>
      )}

      <Card id="versions" title={t("versionsTitle", { count: versions.length })}>
        {versions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noVersions")}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <code className="field-ltr text-xs">{v.version}</code>
                {v.id === plugin.currentVersionId ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                    {t("current")}
                  </span>
                ) : null}
                {v.disabled ? (
                  <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                    {tStatus("disabled")}
                  </span>
                ) : null}
                <time className="text-xs text-ink-muted" dateTime={v.createdAt}>
                  {format.dateTime(new Date(v.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </time>
                <code className="field-ltr text-xs text-ink-muted">{v.sha256.slice(0, 12)}…</code>
              </li>
            ))}
          </ol>
        )}
        {requests.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs text-ink-muted">
            {requests.map((r) => (
              <li key={r.id}>
                {t("requestLine", {
                  version: r.version,
                  status: r.status,
                  date: format.dateTime(new Date(r.createdAt), { dateStyle: "medium" }),
                })}
                {r.decisionNote ? <span dir="auto"> — {r.decisionNote}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {shown ? (
        <Card id="preview" title={t("previewTitle")}>
          <p className="text-sm text-ink-muted">{t("previewLede")}</p>
          <StudioPreview definition={shown.definition} sha256={shown.sha256} playerUrl={playerUrl} />
        </Card>
      ) : null}
    </div>
  );
}
