import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localizedTitle } from "@/modules/content/package-input";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/actor";
import { languageNames, listOwnContent, type ContentFilters, type ContentRow } from "@/server/queries/content";
import { listCatalogue } from "@/server/queries/plugins";

const STATUSES = ["all", "draft", "published", "archived"] as const;
const KINDS = ["all", "package", "course"] as const;

function pick<T extends readonly string[]>(values: T, raw: unknown, fallback: T[number]): T[number] {
  return typeof raw === "string" && (values as readonly string[]).includes(raw) ? (raw as T[number]) : fallback;
}

/** The creator's packages and courses, filtered by status, kind, plugin and language pair; an honest empty state otherwise. */
export default async function MyContentPage({ params, searchParams }: PageProps<"/[locale]/content">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const filters: ContentFilters = {
    status: pick(STATUSES, query.status, "all"),
    kind: pick(KINDS, query.kind, "all"),
    plugin: typeof query.plugin === "string" && /^[0-9a-f-]{36}$/.test(query.plugin) ? query.plugin : undefined,
    pair: typeof query.pair === "string" && /^[a-z]{3}:[a-z]{3}$/.test(query.pair) ? query.pair : undefined,
  };
  const [t, tStatus, format, session] = await Promise.all([
    getTranslations("editor.list"),
    getTranslations("editor.statuses"),
    getFormatter(),
    getSession(),
  ]);
  if (session.actor.kind !== "user") return null;
  const [rows, allRows, catalogue] = await Promise.all([
    listOwnContent(session.actor.userId, filters),
    listOwnContent(session.actor.userId),
    listCatalogue(),
  ]);
  const names = await languageNames(allRows.flatMap((r) => [r.sourceLang, r.targetLang]));
  const pairs = [...new Set(allRows.map((r) => `${r.sourceLang}:${r.targetLang}`))];
  const pairLabel = (row: Pick<ContentRow, "sourceLang" | "targetLang">) =>
    `${names.get(row.sourceLang) ?? row.sourceLang} → ${names.get(row.targetLang) ?? row.targetLang}`;
  const notice = query.notice === "created" ? t("notices.created") : null;
  const isFiltered = filters.status !== "all" || filters.kind !== "all" || filters.plugin || filters.pair;

  return (
    <Card id="mine" title={t("title")}>
      {notice ? <p className="text-sm font-semibold text-accent">{notice}</p> : null}
      {allRows.length > 0 ? (
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{t("filterStatus")}</span>
            <select name="status" className={`${inputClass} h-9 w-auto`} defaultValue={filters.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? t("all") : tStatus(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{t("filterKind")}</span>
            <select name="kind" className={`${inputClass} h-9 w-auto`} defaultValue={filters.kind}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k === "all" ? t("all") : t(`kinds.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{t("filterPlugin")}</span>
            <select name="plugin" className={`${inputClass} h-9 w-auto`} defaultValue={filters.plugin ?? ""}>
              <option value="">{t("all")}</option>
              {catalogue.map((p) => (
                <option key={p.pluginRowId} value={p.pluginRowId}>
                  {p.pluginId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">{t("filterPair")}</span>
            <select name="pair" className={`${inputClass} h-9 w-auto`} defaultValue={filters.pair ?? ""}>
              <option value="">{t("all")}</option>
              {pairs.map((pair) => {
                const [sourceLang, targetLang] = pair.split(":");
                return (
                  <option key={pair} value={pair}>
                    {pairLabel({ sourceLang, targetLang })}
                  </option>
                );
              })}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            {t("apply")}
          </Button>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center">
          <p className="text-sm text-ink-muted">{isFiltered ? t("emptyFiltered") : t("empty")}</p>
          {!isFiltered ? (
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/content/new" className="font-semibold text-accent underline-offset-4 hover:underline">
                {t("createFirst")}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/content/${row.id}`}
                className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-paper p-4 hover:border-line-strong"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold" dir="auto">
                    {localizedTitle(row, locale)}
                  </span>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {tStatus(row.status)}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {t(`kinds.${row.kind === "course" ? "course" : "package"}`)}
                  </span>
                  {row.plugin ? <code className="field-ltr text-xs text-ink-muted">{row.plugin.pluginId}</code> : null}
                </div>
                <span className="text-xs text-ink-muted">
                  {pairLabel(row)}
                  {row.kind === "package" ? ` · ${t("items", { count: row.itemsCount })}` : ""}
                  {" · "}
                  {format.dateTime(new Date(row.updatedAt), { dateStyle: "medium" })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
