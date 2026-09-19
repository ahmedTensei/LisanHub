import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { CONTENT_STATUSES } from "@/modules/content/lifecycle";
import { localizedTitle } from "@/modules/content/package-input";
import { requireCapability } from "@/server/actor";
import { languageNames } from "@/server/queries/content";
import { searchContent, type ContentSearch } from "@/server/queries/oversight";

const KINDS = ["package", "course"] as const;

/**
 * Oversight of the community's content (decision R17): the owner and super
 * administrators search by title, status and kind, and open any item with its
 * preview. Nothing is dumped by default — the page opens on the search box and
 * the few most recently changed items.
 */
export default async function AdminContentPage({ params, searchParams }: PageProps<"/[locale]/admin/content">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "admin.oversee_all", `/${locale}/admin/content`);
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.slice(0, 80) : "";
  const status = CONTENT_STATUSES.find((s) => s === query.status) ?? "";
  const kind = KINDS.find((k) => k === query.kind) ?? "";
  const searched = q !== "" || status !== "" || kind !== "";
  const search: ContentSearch = { q, status, kind, limit: searched ? 100 : 10 };

  const [t, tStatus, format, rows] = await Promise.all([
    getTranslations("admin.content"),
    getTranslations("editor.statuses"),
    getFormatter(),
    searchContent(search),
  ]);
  const names = await languageNames(rows.flatMap((r) => [r.sourceLang, r.targetLang]));

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          dir="auto"
          aria-label={t("searchPlaceholder")}
          className={`${inputClass} h-10 w-full sm:w-72`}
        />
        <select name="status" defaultValue={status} aria-label={t("status")} className={`${inputClass} h-10 w-auto`}>
          <option value="">{t("anyStatus")}</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </select>
        <select name="kind" defaultValue={kind} aria-label={t("kind")} className={`${inputClass} h-10 w-auto`}>
          <option value="">{t("anyKind")}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          {t("search")}
        </Button>
      </form>

      <h3 className="text-sm font-bold text-ink-muted">
        {searched ? t("results", { count: rows.length }) : t("recent")}
      </h3>
      {rows.length === 0 ? <p className="text-sm text-ink-muted">{searched ? t("noResults") : t("empty")}</p> : null}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link href={`/admin/content/${row.id}`} className="font-bold hover:text-accent-strong" dir="auto">
                {localizedTitle(row, locale)}
              </Link>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                {t(`kinds.${row.kind === "course" ? "course" : "package"}`)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  row.status === "hidden" || row.status === "removed"
                    ? "bg-danger-soft text-danger"
                    : row.status === "published"
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-paper text-ink-muted"
                }`}
              >
                {tStatus(row.status)}
              </span>
              {row.pluginId ? <code className="field-ltr text-xs text-ink-muted">{row.pluginId}</code> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              {row.owner ? (
                <Link href={`/admin/users/${row.owner.username}`} className="hover:text-accent-strong" dir="ltr">
                  @{row.owner.username}
                </Link>
              ) : null}
              <span dir="ltr">
                {names.get(row.sourceLang) ?? row.sourceLang} → {names.get(row.targetLang) ?? row.targetLang}
              </span>
              {row.kind === "package" ? <span>{t("items", { count: row.itemsCount })}</span> : null}
              <time dateTime={row.updatedAt}>
                {format.dateTime(new Date(row.updatedAt), { dateStyle: "medium", timeStyle: "short" })}
              </time>
              {row.moderationNote ? (
                <span className="text-danger" dir="auto">
                  {t("hiddenBecause", { reason: row.moderationNote })}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
