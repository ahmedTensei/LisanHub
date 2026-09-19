import { getTranslations, setRequestLocale } from "next-intl/server";
import { publishesDirectly } from "@/modules/authorization/policies";
import { DeleteDraftForm, SubmitVersionForm } from "@/components/studio/studio-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/actor";
import { getPluginLimits } from "@/server/queries/plugins";
import { listPluginRequests, listPluginVersions, validateStudioDraft } from "@/server/queries/studio";
import { loadStudioPage } from "@/server/studio-page";

/**
 * Overview of one plugin: does the draft pass the contract, what was
 * published, what is waiting for review, and the way to publish.
 */
export default async function StudioPluginOverview({ params }: PageProps<"/[locale]/studio/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { plugin, editable } = await loadStudioPage(locale, id);
  const [t, tIssues, session, limits, versions, requests] = await Promise.all([
    getTranslations("studio.overview"),
    getTranslations("studio.issues"),
    getSession(),
    getPluginLimits(),
    listPluginVersions(id),
    listPluginRequests(id),
  ]);
  const validation = validateStudioDraft(plugin.draft, limits);
  const pending = requests.find((r) => r.status === "pending");
  const lastDecision = requests.find((r) => r.status !== "pending");
  const direct = publishesDirectly(session.actor);

  return (
    <>
      <Card id="contract" title={t("contractTitle")}>
        {validation.ok ? (
          <Alert tone="success">
            {t("contractOk", {
              activities: validation.definition.activities.length,
              templates: validation.definition.templates.length,
            })}
          </Alert>
        ) : (
          <>
            <Alert tone="error">{t("contractFails", { count: validation.issues.length })}</Alert>
            <ul className="flex flex-col gap-1 text-sm">
              {validation.issues.map((issue) => (
                <li key={`${issue.path}|${issue.code}`} className="flex flex-wrap gap-2">
                  <code className="field-ltr rounded bg-paper px-1.5 text-xs text-ink-muted">{issue.path || "—"}</code>
                  <span>{tIssues(issue.code)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card id="publish" title={t("publishTitle")}>
        {pending ? <Alert tone="info">{t("pendingReview", { version: pending.version })}</Alert> : null}
        {lastDecision && !pending ? (
          <Alert tone={lastDecision.status === "approved" ? "success" : "error"}>
            <span>{t(`decision.${lastDecision.status}`, { version: lastDecision.version })}</span>
            {lastDecision.decisionReason ? <span>{t(`reasons.${lastDecision.decisionReason}`)}</span> : null}
            {lastDecision.decisionNote ? <span dir="auto">{lastDecision.decisionNote}</span> : null}
          </Alert>
        ) : null}
        <p className="text-sm text-ink-muted">{direct ? t("publishLedeDirect") : t("publishLedeReview")}</p>
        {editable && validation.ok && !pending ? (
          <SubmitVersionForm pluginRowId={plugin.id} version={plugin.draft.version} direct={direct} />
        ) : null}
        {!validation.ok ? <p className="text-sm text-ink-muted">{t("fixFirst")}</p> : null}
      </Card>

      <Card id="versions" title={t("versionsTitle")}>
        {versions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("noVersions")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2"
              >
                <span className="field-ltr font-semibold">v{v.version}</span>
                <code className="field-ltr text-xs text-ink-muted">{v.sha256.slice(0, 12)}…</code>
                <span className="text-xs text-ink-muted">{new Date(v.createdAt).toLocaleDateString(locale)}</span>
                {v.id === plugin.currentVersionId ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {t("current")}
                  </span>
                ) : null}
                {v.disabled ? (
                  <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                    {t("versionDisabled")}
                  </span>
                ) : null}
                {v.changeNote ? (
                  <span className="text-xs text-ink-muted" dir="auto">
                    {v.changeNote}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editable && plugin.status === "draft" && !plugin.currentVersionId ? (
        <Card id="danger" title={t("dangerTitle")}>
          <p className="text-sm text-ink-muted">{t("dangerLede")}</p>
          <DeleteDraftForm pluginRowId={plugin.id} />
        </Card>
      ) : null}
    </>
  );
}
