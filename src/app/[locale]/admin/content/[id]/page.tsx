import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ModerateContentForm } from "@/components/admin/moderation-forms";
import { PackagePreview } from "@/components/editor/package-preview";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { localizedSummary, localizedTitle } from "@/modules/content/package-input";
import { getSession, requireCapability } from "@/server/actor";
import { loadPackage } from "@/server/packages/store";
import { playerUrlForRequest } from "@/server/player-origin";
import { languageNames } from "@/server/queries/content";
import { getContentOversight } from "@/server/queries/oversight";
import { getPluginVersion, playabilityOf } from "@/server/queries/plugins";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * One item under oversight (decision R17): what it is, whose it is, where it
 * comes from (derivation chain), its versions, the preview a learner would
 * get in the sandboxed player, and the moderation actions. Read-only apart
 * from hiding and restoring; editing stays with the owner.
 */
export default async function AdminContentItemPage({ params }: PageProps<"/[locale]/admin/content/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "admin.oversee_all", `/${locale}/admin/content/${id}`);
  if (!UUID.test(id)) notFound();
  const [t, tStatus, tSkills, format, session, playerUrl, oversight] = await Promise.all([
    getTranslations("admin.content"),
    getTranslations("editor.statuses"),
    getTranslations("studio.skills"),
    getFormatter(),
    getSession(),
    playerUrlForRequest(),
    getContentOversight(id),
  ]);
  if (!oversight) notFound();
  const { item, owner, moderation, versions, lessons, courses, lineage } = oversight;
  const names = await languageNames([item.sourceLang, item.targetLang]);
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";
  const mayModerate = session.actor.kind === "user" && session.actor.adminRank !== null;

  // Preview: the published version when there is one, the working copy otherwise.
  let preview: {
    definition: Awaited<ReturnType<typeof getPluginVersion>>;
    loaded: Awaited<ReturnType<typeof loadPackage>> | null;
    version: string;
    paused: string | null;
  } | null = null;
  if (item.kind === "package" && item.pluginVersionId && item.packageKey) {
    const current = item.currentVersionId ? versions.find((v) => v.id === item.currentVersionId) : null;
    const plugin = await getPluginVersion(item.pluginVersionId);
    const playable = plugin ? playabilityOf(plugin, locale) : null;
    const loaded = plugin
      ? await loadPackage(current ? current.packageKey : item.packageKey, current ? "publish" : "draft")
      : null;
    preview = {
      definition: plugin,
      loaded,
      version: current ? current.id : "draft",
      paused: playable && !playable.ok ? playable.reason : null,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <Card id="item" title={localizedTitle(item, locale)}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
            {t(`kinds.${item.kind === "course" ? "course" : "package"}`)}
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
            {tStatus(item.status)}
          </span>
          {item.plugin ? <code className="field-ltr text-xs text-ink-muted">{item.plugin.pluginId}</code> : null}
          <code className="field-ltr text-xs text-ink-muted">{item.title}</code>
        </div>
        {localizedSummary(item, locale) ? (
          <p className="text-sm" dir="auto">
            {localizedSummary(item, locale)}
          </p>
        ) : null}
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">{t("owner")}</dt>
            <dd>
              {owner ? (
                <Link href={`/admin/users/${owner.username}`} className={linkClass} dir="auto">
                  {owner.displayName} <span dir="ltr">@{owner.username}</span>
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("pair")}</dt>
            <dd dir="ltr">
              {names.get(item.sourceLang) ?? item.sourceLang} → {names.get(item.targetLang) ?? item.targetLang}
              {item.dialectTag ? ` · ${item.dialectTag}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("level")}</dt>
            <dd dir="ltr">{item.cefr ? `${item.cefr}${item.cefrSublevel ? `.${item.cefrSublevel}` : ""}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("skills")}</dt>
            <dd>{item.skills.length ? item.skills.map((s) => tSkills(s)).join("، ") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("tags")}</dt>
            <dd dir="auto">{item.tags.length ? item.tags.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("dates")}</dt>
            <dd>
              {t("createdOn", { date: format.dateTime(new Date(item.createdAt), { dateStyle: "medium" }) })}
              {item.publishedAt
                ? ` · ${t("publishedOn", { date: format.dateTime(new Date(item.publishedAt), { dateStyle: "medium" }) })}`
                : ""}
            </dd>
          </div>
        </dl>
      </Card>

      <Card id="moderation" title={t("moderationTitle")}>
        {moderation.note ? (
          <Alert tone="error">
            <span dir="auto">{t("hiddenBecause", { reason: moderation.note })}</span>
            {moderation.byUsername && moderation.at ? (
              <span className="text-xs">
                {t("moderatedBy", {
                  username: moderation.byUsername,
                  date: format.dateTime(new Date(moderation.at), { dateStyle: "medium", timeStyle: "short" }),
                })}
              </span>
            ) : null}
          </Alert>
        ) : (
          <p className="text-sm text-ink-muted">{t("moderationLede")}</p>
        )}
        {mayModerate ? <ModerateContentForm itemId={item.id} status={item.status} /> : null}
        <p className="text-xs text-ink-muted">{t("warningLater")}</p>
      </Card>

      {lineage.length > 0 ? (
        <Card id="lineage" title={t("lineageTitle")}>
          <ol className="flex flex-col gap-1 text-sm">
            {lineage.map((link, index) => (
              <li key={`${link.itemId}-${index}`} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-muted">{index + 1}.</span>
                <Link href={`/admin/content/${link.itemId}`} className={linkClass} dir="auto">
                  {link.title}
                </Link>
                {link.ownerUsername ? (
                  <span className="text-xs text-ink-muted" dir="ltr">
                    @{link.ownerUsername}
                  </span>
                ) : null}
                {link.versionNumber !== null ? (
                  <span className="text-xs text-ink-muted">{t("versionN", { n: link.versionNumber })}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {item.kind === "course" ? (
        <Card id="lessons" title={t("lessonsTitle", { count: lessons.length })}>
          {lessons.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noLessons")}</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {lessons.map((lesson) => (
                <li key={lesson.lessonId} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-muted">{lesson.position + 1}.</span>
                  <Link href={`/admin/content/${lesson.lessonId}`} className={linkClass} dir="auto">
                    {localizedTitle(lesson, locale)}
                  </Link>
                  <span className="text-xs text-ink-muted">{tStatus(lesson.status)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : null}

      {courses.length > 0 ? (
        <Card id="courses" title={t("inCoursesTitle")}>
          <ul className="flex flex-col gap-1 text-sm">
            {courses.map((course) => (
              <li key={course.id}>
                <Link href={`/admin/content/${course.id}`} className={linkClass} dir="auto">
                  {localizedTitle(course, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {item.kind === "package" ? (
        <Card id="versions" title={t("versionsTitle", { count: versions.length })}>
          {versions.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("noVersions")}</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t("versionN", { n: v.versionNumber })}</span>
                  {v.id === item.currentVersionId ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                      {t("current")}
                    </span>
                  ) : null}
                  <time className="text-xs text-ink-muted" dateTime={v.createdAt}>
                    {format.dateTime(new Date(v.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                  <span className="text-xs text-ink-muted">{t("items", { count: v.itemsCount })}</span>
                  <code className="field-ltr text-xs text-ink-muted">{v.packageSha256.slice(0, 12)}…</code>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : null}

      {preview ? (
        <Card id="preview" title={preview.version === "draft" ? t("previewDraftTitle") : t("previewTitle")}>
          <p className="text-sm text-ink-muted">{t("previewLede")}</p>
          {!preview.definition ? (
            <Alert tone="error">{t("pluginMissing")}</Alert>
          ) : preview.paused ? (
            <Alert tone="error">{t("pluginPaused")}</Alert>
          ) : !preview.loaded || !preview.loaded.ok ? (
            <Alert tone="error">{t("unreadable")}</Alert>
          ) : (
            <PackagePreview
              packageId={item.id}
              version={preview.version}
              definition={preview.definition.definition}
              definitionSha256={preview.definition.sha256}
              items={preview.loaded.package.content.items}
              playerUrl={playerUrl}
            />
          )}
        </Card>
      ) : null}
    </div>
  );
}
