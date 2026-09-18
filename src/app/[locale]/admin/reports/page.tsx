import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/action-form";
import { inputClass } from "@/components/ui/field";
import { updateReportStatus } from "@/server/actions/admin";
import { requireCapability } from "@/server/actor";
import { listConductReports, listContentReports } from "@/server/queries/admin";

const NEXT_STATUSES = ["acknowledged", "escalated", "resolved", "dismissed"] as const;

export default async function AdminReportsPage({ params }: PageProps<"/[locale]/admin/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "moderation.handle_queue", `/${locale}/admin/reports`);
  const [t, format, content, conduct] = await Promise.all([
    getTranslations("admin.reports"),
    getFormatter(),
    listContentReports(),
    listConductReports(),
  ]);
  const update = updateReportStatus.bind(null, locale);
  const open = (status: string) => status === "open" || status === "escalated" || status === "acknowledged";

  const statusSelect = (
    <select name="status" defaultValue="acknowledged" className={`${inputClass} h-9 w-auto`}>
      {NEXT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`statuses.${s}`)}
        </option>
      ))}
    </select>
  );

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink-muted">
          {t("contentTitle")} · {content.filter((r) => open(r.status)).length}
        </h3>
        {content.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("emptyContent")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {content.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                    {t(`types.${row.type}`)}
                  </span>
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {t(`statuses.${row.status}`)}
                  </span>
                  <span className="font-semibold" dir="auto">
                    {row.itemTitle}
                  </span>
                  <span className="text-ink-muted" dir="ltr">
                    @{row.reporter}
                  </span>
                  <time className="text-xs text-ink-muted" dateTime={row.createdAt}>
                    {format.dateTime(new Date(row.createdAt), { dateStyle: "medium" })}
                  </time>
                </div>
                {row.message ? (
                  <p className="text-sm" dir="auto">
                    {row.message}
                  </p>
                ) : null}
                {open(row.status) ? (
                  <ActionForm
                    action={update}
                    messages="admin"
                    hidden={{ id: row.id, table: "reports" }}
                    submitLabel={t("apply")}
                  >
                    {statusSelect}
                    <input
                      name="note"
                      placeholder={t("notePlaceholder")}
                      maxLength={2000}
                      dir="auto"
                      className={`${inputClass} h-9 w-full sm:w-72`}
                    />
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink-muted">
          {t("conductTitle")} · {conduct.filter((r) => open(r.status)).length}
        </h3>
        {conduct.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("emptyConduct")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {conduct.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                    {t(`contexts.${row.context}`)}
                  </span>
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {t(`statuses.${row.status}`)}
                  </span>
                  <span dir="ltr">@{row.reporter}</span>
                  <span className="text-ink-muted">→</span>
                  <span className="font-semibold" dir="ltr">
                    @{row.reported}
                  </span>
                  <time className="text-xs text-ink-muted" dateTime={row.createdAt}>
                    {format.dateTime(new Date(row.createdAt), { dateStyle: "medium" })}
                  </time>
                </div>
                <p className="text-sm" dir="auto">
                  {row.message}
                </p>
                {open(row.status) ? (
                  <ActionForm
                    action={update}
                    messages="admin"
                    hidden={{ id: row.id, table: "conduct_reports" }}
                    submitLabel={t("apply")}
                  >
                    {statusSelect}
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
