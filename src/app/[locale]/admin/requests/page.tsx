import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/action-form";
import { Link } from "@/i18n/navigation";
import { inputClass } from "@/components/ui/field";
import { canDecideSupportRequest } from "@/modules/authorization/policies";
import { decideSupportRequest } from "@/server/actions/admin";
import { getSession, requireCapability } from "@/server/actor";
import { listSupportRequests, type SupportRequestRow } from "@/server/queries/admin";

function StatusPill({ label, tone }: { label: string; tone: "open" | "review" | "done" | "rejected" }) {
  const cls = {
    open: "bg-saffron-soft text-saffron",
    review: "bg-accent-soft text-accent-strong",
    done: "bg-accent-soft text-accent-strong",
    rejected: "bg-danger-soft text-danger",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

export default async function AdminRequestsPage({ params }: PageProps<"/[locale]/admin/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "moderation.handle_queue", `/${locale}/admin/requests`);
  const [t, tAccount, format, session, pending, closed] = await Promise.all([
    getTranslations("admin.requests"),
    getTranslations("account.role"),
    getFormatter(),
    getSession(),
    listSupportRequests("pending"),
    listSupportRequests("closed"),
  ]);
  const decide = decideSupportRequest.bind(null, locale);
  const tone = (status: SupportRequestRow["status"]) =>
    status === "open" ? "open" : status === "in_review" ? "review" : status === "resolved" ? "done" : "rejected";

  const groups = [
    { key: "revert_to_student", rows: pending.filter((r) => r.kind === "revert_to_student") },
    { key: "other", rows: pending.filter((r) => r.kind === "other") },
  ] as const;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </div>

      {pending.length === 0 ? <p className="text-sm text-ink-muted">{t("emptyPending")}</p> : null}

      {groups.map((group) =>
        group.rows.length === 0 ? null : (
          <div key={group.key} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-ink-muted">
              {t(`kinds.${group.key}`)} · {group.rows.length}
            </h3>
            <ul className="flex flex-col gap-3">
              {group.rows.map((row) => {
                const canResolve = canDecideSupportRequest(session.actor, row.kind, "resolved").allowed;
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        <Link
                          href={`/u/${row.user.username}`}
                          className="font-semibold hover:text-accent-strong"
                          dir="auto"
                        >
                          {row.user.displayName}
                        </Link>{" "}
                        <span className="text-ink-muted" dir="ltr">
                          @{row.user.username}
                        </span>{" "}
                        <span className="text-ink-muted">· {tAccount(row.user.primaryRole)}</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <StatusPill label={t(`statuses.${row.status}`)} tone={tone(row.status)} />
                        <time dateTime={row.createdAt}>
                          {format.dateTime(new Date(row.createdAt), { dateStyle: "medium" })}
                        </time>
                      </div>
                    </div>
                    {row.message ? (
                      <p className="whitespace-pre-wrap text-sm" dir="auto">
                        {row.message}
                      </p>
                    ) : null}
                    <ActionForm
                      action={decide}
                      messages="admin"
                      hidden={{ id: row.id, kind: row.kind }}
                      submitLabel={t("apply")}
                      variant="primary"
                    >
                      <select
                        name="decision"
                        defaultValue={row.status === "open" || !canResolve ? "in_review" : "resolved"}
                        className={`${inputClass} h-9 w-auto`}
                      >
                        <option value="in_review">{t("decisions.in_review")}</option>
                        <option value="resolved" disabled={!canResolve}>
                          {t("decisions.resolved")}
                          {canResolve ? "" : ` (${t("administratorOnly")})`}
                        </option>
                        <option value="rejected">{t("decisions.rejected")}</option>
                      </select>
                      <input
                        name="note"
                        placeholder={t("notePlaceholder")}
                        maxLength={2000}
                        dir="auto"
                        className={`${inputClass} h-9 w-full sm:w-72`}
                      />
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}

      <details className="rounded-[var(--radius-card)] border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-muted">
          {t("closedTitle")} · {closed.length}
        </summary>
        {closed.length === 0 ? (
          <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">{t("emptyClosed")}</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {closed.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={t(`statuses.${row.status}`)} tone={tone(row.status)} />
                  <span className="font-semibold" dir="auto">
                    {row.user.displayName}
                  </span>
                  <span className="text-ink-muted">{t(`kinds.${row.kind}`)}</span>
                  {row.handledBy ? (
                    <span className="text-ink-muted" dir="ltr">
                      · @{row.handledBy}
                    </span>
                  ) : null}
                  {row.resolvedAt ? (
                    <time className="text-xs text-ink-muted" dateTime={row.resolvedAt}>
                      {format.dateTime(new Date(row.resolvedAt), { dateStyle: "medium" })}
                    </time>
                  ) : null}
                </div>
                {row.resolutionNote ? (
                  <p className="text-ink-muted" dir="auto">
                    {row.resolutionNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
