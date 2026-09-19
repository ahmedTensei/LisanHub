import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RollbackForm } from "@/components/editor/content-forms";
import { Card } from "@/components/ui/card";
import { loadContentPage } from "@/server/content-page";
import { listContentVersions } from "@/server/queries/content";

/** Published versions of a package; rolling back republishes an earlier file as a new version (audited). */
export default async function PackageHistoryPage({ params }: PageProps<"/[locale]/content/[id]/history">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [{ item, editable }, t, format] = await Promise.all([
    loadContentPage(locale, id),
    getTranslations("editor.history"),
    getFormatter(),
  ]);
  if (item.kind !== "package") notFound();
  const versions = await listContentVersions(item.id);
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <Card id="history" title={t("title")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {versions.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t("empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{t("version", { n: v.versionNumber })}</span>
                {v.id === item.currentVersionId ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {t("current")}
                  </span>
                ) : null}
                <span className="text-xs text-ink-muted">
                  {format.dateTime(new Date(v.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className="text-xs text-ink-muted">{t("items", { count: v.itemsCount })}</span>
                <code className="field-ltr text-xs text-ink-muted">{v.packageSha256.slice(0, 12)}…</code>
              </div>
              {v.changeNote ? (
                <p className="text-xs text-ink-muted" dir="auto">
                  {v.changeNote.startsWith("rollback:")
                    ? t("rollbackNote", { n: v.changeNote.slice("rollback:".length) })
                    : v.changeNote}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-4">
                <Link href={`/content/${item.id}/preview?version=${v.id}`} className={linkClass}>
                  {t("preview")}
                </Link>
                {editable && v.id !== item.currentVersionId ? (
                  <RollbackForm itemId={item.id} versionId={v.id} versionNumber={v.versionNumber} />
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
