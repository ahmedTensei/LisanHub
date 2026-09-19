import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { canDisablePlugin } from "@/modules/authorization/policies";
import { ActionForm } from "@/components/forms/action-form";
import { inputClass } from "@/components/ui/field";
import { reviewPluginRequest, setPluginHidden, setPluginKillSwitch } from "@/server/actions/admin";
import { getSession, requireCapability } from "@/server/actor";
import { listAdminPlugins, listPublishRequests } from "@/server/queries/admin-plugins";

const REASONS = ["contract", "quality", "duplicate", "policy", "other"] as const;

/**
 * Plugin moderation (decision R10): publish requests from Contributors, then
 * the catalogue with the kill switch per plugin and per version, and hiding.
 * The studio itself is elsewhere: this page only reviews and stops.
 */
export default async function AdminPluginsPage({ params }: PageProps<"/[locale]/admin/plugins">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "plugins.review", `/${locale}/admin/plugins`);
  const [t, tStatus, format, session, pending, decided, plugins] = await Promise.all([
    getTranslations("admin.plugins"),
    getTranslations("studio.status"),
    getFormatter(),
    getSession(),
    listPublishRequests("pending"),
    listPublishRequests("decided"),
    listAdminPlugins(),
  ]);
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const review = reviewPluginRequest.bind(null, locale);
  const killSwitch = setPluginKillSwitch.bind(null, locale);
  const hide = setPluginHidden.bind(null, locale);
  const mayDisable = canDisablePlugin(session.actor).allowed;
  const card = "flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4";
  const detailLink = "text-xs font-semibold text-accent underline-offset-4 hover:underline";
  const name = (n: { ar: string; fr: string; en: string } | null, fallback: string) =>
    n?.[uiLocale] || n?.en || n?.ar || fallback;

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("queueTitle")}</h2>
        <p className="text-sm text-ink-muted">{t("queueLede")}</p>
        {pending.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            {t("queueEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((r) => (
              <li key={r.id} className={card}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold" dir="auto">
                    {name(r.name, r.pluginId)}
                  </span>
                  <code className="field-ltr rounded bg-paper px-1.5 text-xs text-ink-muted">
                    {r.pluginId}@{r.version}
                  </code>
                  <span className="text-xs text-ink-muted">
                    {t("by")} <span className="field-ltr">@{r.requestedBy.username}</span> ·{" "}
                    {format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })}
                  </span>
                  <Link href={`/admin/plugins/${r.pluginRowId}`} className={detailLink}>
                    {t("openDetail")}
                  </Link>
                </div>
                <p className="text-xs text-ink-muted">
                  {t("summary", { activities: r.activities, templates: r.templates })}
                  {r.changeNote ? (
                    <>
                      {" · "}
                      <span dir="auto">{r.changeNote}</span>
                    </>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-start gap-4">
                  <ActionForm
                    action={review}
                    messages="admin"
                    hidden={{ id: r.id, decision: "approve" }}
                    submitLabel={t("approve")}
                    variant="primary"
                  />
                  <ActionForm
                    action={review}
                    messages="admin"
                    hidden={{ id: r.id, decision: "reject" }}
                    submitLabel={t("reject")}
                    variant="danger"
                  >
                    <select
                      name="reason"
                      className={`${inputClass} h-9 w-auto`}
                      aria-label={t("reason")}
                      defaultValue="contract"
                    >
                      {REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {t(`reasons.${reason}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="note"
                      className={`${inputClass} h-9 w-64`}
                      placeholder={t("notePlaceholder")}
                      aria-label={t("note")}
                      dir="auto"
                    />
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("catalogueTitle")}</h2>
        <p className="text-sm text-ink-muted">{t("catalogueLede")}</p>
        {plugins.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            {t("catalogueEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {plugins.map((p) => (
              <li key={p.id} className={card}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold" dir="auto">
                    {name(p.name, p.pluginId)}
                  </span>
                  <code className="field-ltr rounded bg-paper px-1.5 text-xs text-ink-muted">{p.pluginId}</code>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {tStatus(p.status)}
                  </span>
                  <Link href={`/admin/plugins/${p.id}`} className={detailLink}>
                    {t("openDetail")}
                  </Link>
                  {p.disabled ? (
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                      {tStatus("disabled")}
                    </span>
                  ) : null}
                  <span className="text-xs text-ink-muted">
                    {p.ownerUsername ? <span className="field-ltr">@{p.ownerUsername}</span> : t("platformOwned")}
                  </span>
                </div>
                {mayDisable ? (
                  <div className="flex flex-wrap items-start gap-4">
                    {p.disabled ? (
                      <ActionForm
                        action={killSwitch}
                        messages="admin"
                        hidden={{ plugin: p.id, disabled: "false" }}
                        submitLabel={t("enable")}
                        variant="primary"
                      />
                    ) : (
                      <ActionForm
                        action={killSwitch}
                        messages="admin"
                        hidden={{ plugin: p.id, disabled: "true" }}
                        submitLabel={t("disable")}
                        variant="danger"
                      >
                        <input
                          name="note"
                          className={`${inputClass} h-9 w-64`}
                          placeholder={t("disableNote")}
                          aria-label={t("disableNote")}
                          dir="auto"
                        />
                      </ActionForm>
                    )}
                    {p.status === "published" ? (
                      <ActionForm
                        action={hide}
                        messages="admin"
                        hidden={{ plugin: p.id, hidden: "true" }}
                        submitLabel={t("hide")}
                      />
                    ) : p.status === "hidden" ? (
                      <ActionForm
                        action={hide}
                        messages="admin"
                        hidden={{ plugin: p.id, hidden: "false" }}
                        submitLabel={t("show")}
                        variant="primary"
                      />
                    ) : null}
                  </div>
                ) : null}
                {p.versions.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-xs">
                    {p.versions.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2">
                        <span className="field-ltr font-semibold">v{v.version}</span>
                        {v.id === p.currentVersion?.id ? <span className="text-accent">{t("current")}</span> : null}
                        {v.disabled ? <span className="text-danger">{tStatus("disabled")}</span> : null}
                        {mayDisable ? (
                          <ActionForm
                            action={killSwitch}
                            messages="admin"
                            hidden={{ plugin: p.id, version: v.id, disabled: v.disabled ? "false" : "true" }}
                            submitLabel={v.disabled ? t("enableVersion") : t("disableVersion")}
                            variant={v.disabled ? "primary" : "danger"}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{t("decidedTitle")}</h2>
          <ul className="flex flex-col divide-y divide-line text-sm">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <code className="field-ltr text-xs text-ink-muted">
                  {r.pluginId}@{r.version}
                </code>
                <span className={r.status === "approved" ? "text-accent" : "text-danger"}>
                  {t(`decisions.${r.status}`)}
                </span>
                {r.decisionReason ? (
                  <span className="text-xs text-ink-muted">{t(`reasons.${r.decisionReason}`)}</span>
                ) : null}
                {r.decidedAt ? (
                  <span className="text-xs text-ink-muted">
                    {format.dateTime(new Date(r.decidedAt), { dateStyle: "medium" })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
