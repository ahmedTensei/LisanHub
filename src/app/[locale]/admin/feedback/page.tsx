import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/action-form";
import { inputClass } from "@/components/ui/field";
import { triageFeedback } from "@/server/actions/admin";
import { requireCapability } from "@/server/actor";
import { listProductFeedback } from "@/server/queries/admin";

const STATUSES = ["new", "reviewed", "planned", "done", "dismissed"] as const;
const CATEGORIES = ["bug", "idea", "learning", "content", "community", "general"] as const;

/** Platform feedback inbox (phase B improvement loop), grouped by category. */
export default async function AdminFeedbackPage({ params }: PageProps<"/[locale]/admin/feedback">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "moderation.handle_queue", `/${locale}/admin/feedback`);
  const [t, format, rows] = await Promise.all([
    getTranslations("admin.feedback"),
    getFormatter(),
    listProductFeedback(),
  ]);
  const triage = triageFeedback.bind(null, locale);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-ink-muted">{t("empty")}</p> : null}
      {CATEGORIES.map((category) => {
        const items = rows.filter((r) => r.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-ink-muted">
              {t(`categories.${category}`)} · {items.length}
            </h3>
            <ul className="flex flex-col gap-3">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {row.score ? (
                      <span
                        className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron"
                        dir="ltr"
                      >
                        {row.score}/5
                      </span>
                    ) : null}
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                      {t(`statuses.${row.status}`)}
                    </span>
                    <span className="text-ink-muted" dir="ltr">
                      @{row.author}
                    </span>
                    {row.pagePath ? (
                      <span className="text-xs text-ink-muted" dir="ltr">
                        {row.pagePath}
                      </span>
                    ) : null}
                    <time className="text-xs text-ink-muted" dateTime={row.createdAt}>
                      {format.dateTime(new Date(row.createdAt), { dateStyle: "medium" })}
                    </time>
                  </div>
                  {row.message ? (
                    <p className="whitespace-pre-wrap text-sm" dir="auto">
                      {row.message}
                    </p>
                  ) : null}
                  <ActionForm action={triage} messages="admin" hidden={{ id: row.id }} submitLabel={t("apply")}>
                    <select name="status" defaultValue={row.status} className={`${inputClass} h-9 w-auto`}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`statuses.${s}`)}
                        </option>
                      ))}
                    </select>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
