import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isUiLocale } from "@/modules/account/ui-locales";
import { localizedTitle } from "@/modules/content/package-input";
import { ActionForm } from "@/components/forms/action-form";
import { MetadataForm, PublishForm, StatusForm } from "@/components/editor/content-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import {
  addCourseLesson,
  addItem,
  moveContentItem,
  moveCourseLesson,
  removeContentItem,
  removeCourseLesson,
} from "@/server/actions/content";
import { loadContentPage } from "@/server/content-page";
import { loadPackage } from "@/server/packages/store";
import { listCourseLessons, listOwnContent } from "@/server/queries/content";
import { getPluginVersion } from "@/server/queries/plugins";

/**
 * Editing a package (metadata, items, publication) or a course (metadata,
 * ordered lessons). Every change is one explicit action; publication goes
 * through a second confirmation.
 */
export default async function ContentItemPage({ params, searchParams }: PageProps<"/[locale]/content/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const uiLocale = isUiLocale(locale) ? locale : "ar";
  const [{ item, editable, userId }, t, tStatus] = await Promise.all([
    loadContentPage(locale, id),
    getTranslations("editor.item"),
    getTranslations("editor.statuses"),
  ]);
  const notice = query.notice === "created" ? (item.kind === "course" ? t("createdCourse") : t("created")) : null;
  const metadata = {
    title: item.title,
    summary: item.summary ?? "",
    translations: item.translations,
    dialect: item.dialectTag ?? "",
    cefr: item.cefr ?? "",
    cefrSublevel: item.cefrSublevel ? String(item.cefrSublevel) : "",
    skills: item.skills,
    tags: item.tags.join(", "),
  };
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  if (item.kind === "course") {
    const [lessons, own] = await Promise.all([listCourseLessons(item.id), listOwnContent(userId, { kind: "package" })]);
    const candidates = own.filter(
      (p) =>
        !lessons.some((l) => l.lessonId === p.id) &&
        p.sourceLang === item.sourceLang &&
        p.targetLang === item.targetLang,
    );
    const add = addCourseLesson.bind(null, locale);
    const remove = removeCourseLesson.bind(null, locale);
    const move = moveCourseLesson.bind(null, locale);
    return (
      <>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Card id="metadata" title={t("metadataTitle")}>
          {editable ? <MetadataForm itemId={item.id} initial={metadata} kind="course" /> : null}
        </Card>
        <Card id="lessons" title={t("lessonsTitle")}>
          <p className="text-sm text-ink-muted">{t("lessonsLede")}</p>
          {lessons.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
              {t("lessonsEmpty")}
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {lessons.map((lesson, i) => (
                <li
                  key={lesson.lessonId}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm"
                >
                  <span className="w-6 text-xs text-ink-muted">{i + 1}.</span>
                  <Link href={`/content/${lesson.lessonId}`} className={linkClass} dir="auto">
                    {localizedTitle(lesson, locale)}
                  </Link>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                    {tStatus(lesson.status)}
                  </span>
                  {lesson.pluginId ? <code className="field-ltr text-xs text-ink-muted">{lesson.pluginId}</code> : null}
                  {editable ? (
                    <div className="ms-auto flex flex-wrap gap-2">
                      <ActionForm
                        action={move}
                        messages="editor"
                        hidden={{ id: item.id, lesson: lesson.lessonId, direction: "up" }}
                        submitLabel={t("moveUp")}
                      />
                      <ActionForm
                        action={move}
                        messages="editor"
                        hidden={{ id: item.id, lesson: lesson.lessonId, direction: "down" }}
                        submitLabel={t("moveDown")}
                      />
                      <ActionForm
                        action={remove}
                        messages="editor"
                        hidden={{ id: item.id, lesson: lesson.lessonId }}
                        submitLabel={t("removeFromCourse")}
                        variant="danger"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {editable ? (
            candidates.length > 0 ? (
              <ActionForm
                action={add}
                messages="editor"
                hidden={{ id: item.id }}
                submitLabel={t("addToCourse")}
                variant="primary"
              >
                <select name="lesson" className={`${inputClass} h-9 w-auto`} aria-label={t("choosePackage")}>
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {localizedTitle(p, locale)} ({tStatus(p.status)})
                    </option>
                  ))}
                </select>
              </ActionForm>
            ) : (
              <p className="text-sm text-ink-muted">{t("noCandidates")}</p>
            )
          ) : null}
        </Card>
        {editable ? (
          <Card id="status" title={t("statusTitle")}>
            <p className="text-sm text-ink-muted">{t("courseStatusLede")}</p>
            <StatusForm itemId={item.id} status={item.status} hasVersion everPublished={item.publishedAt !== null} />
          </Card>
        ) : null}
      </>
    );
  }

  const plugin = item.pluginVersionId ? await getPluginVersion(item.pluginVersionId) : null;
  const draft = item.packageKey ? await loadPackage(item.packageKey, "draft") : null;
  const add = addItem.bind(null, locale);
  const remove = removeContentItem.bind(null, locale);
  const move = moveContentItem.bind(null, locale);
  const activityName = (activityId: string) =>
    plugin?.definition.activities.find((a) => a.id === activityId)?.name[uiLocale] ?? activityId;
  const unpublishedChanges =
    item.currentVersionId !== null &&
    draft?.ok === true &&
    item.packageSha256 !== null &&
    item.status === "published" &&
    draft.package.fileSha256 !== item.packageSha256;

  return (
    <>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Card id="items" title={t("itemsTitle")}>
        <p className="text-sm text-ink-muted">{t("itemsLede")}</p>
        {!draft || !draft.ok ? (
          <Alert tone="error">{t("draftUnreadable")}</Alert>
        ) : draft.package.content.items.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            {t("itemsEmpty")}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {draft.package.content.items.map((entry, i) => {
              const activity = plugin?.definition.activities.find((a) => a.id === entry.activity);
              const firstText = activity?.fields
                .map((f) => entry.fields[f.key])
                .find((v) => typeof v === "string" && v.trim() !== "") as string | undefined;
              return (
                <li
                  key={entry.item_id}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm"
                >
                  <span className="w-6 text-xs text-ink-muted">{i + 1}.</span>
                  <Link href={`/content/${item.id}/items/${entry.item_id}`} className={linkClass} dir="auto">
                    {firstText ? firstText.slice(0, 80) : t("untitledItem")}
                  </Link>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {activityName(entry.activity)}
                  </span>
                  {editable ? (
                    <div className="ms-auto flex flex-wrap gap-2">
                      <ActionForm
                        action={move}
                        messages="editor"
                        hidden={{ id: item.id, item: entry.item_id, direction: "up" }}
                        submitLabel={t("moveUp")}
                      />
                      <ActionForm
                        action={move}
                        messages="editor"
                        hidden={{ id: item.id, item: entry.item_id, direction: "down" }}
                        submitLabel={t("moveDown")}
                      />
                      <ActionForm
                        action={remove}
                        messages="editor"
                        hidden={{ id: item.id, item: entry.item_id }}
                        submitLabel={t("removeItem")}
                        variant="danger"
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        {editable && plugin ? (
          <ActionForm
            action={add}
            messages="editor"
            hidden={{ id: item.id }}
            submitLabel={t("addItem")}
            variant="primary"
          >
            <select name="activity" className={`${inputClass} h-9 w-auto`} aria-label={t("chooseActivity")}>
              {plugin.definition.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name[uiLocale] || a.id}
                </option>
              ))}
            </select>
          </ActionForm>
        ) : null}
      </Card>

      <Card id="metadata" title={t("metadataTitle")}>
        {editable ? <MetadataForm itemId={item.id} initial={metadata} kind="package" /> : null}
      </Card>

      {editable ? (
        <Card id="publish" title={t("publishTitle")}>
          <p className="text-sm text-ink-muted">
            {item.currentVersionId ? t("publishLedeAgain") : t("publishLedeFirst")}
          </p>
          {unpublishedChanges ? <Alert tone="info">{t("unpublishedChanges")}</Alert> : null}
          <PublishForm itemId={item.id} hasVersion={item.currentVersionId !== null} />
          {item.currentVersionId ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href={`/content/${item.id}/history`} className={linkClass}>
                {t("openHistory")}
              </Link>
            </div>
          ) : null}
          <StatusForm
            itemId={item.id}
            status={item.status}
            hasVersion={item.currentVersionId !== null}
            everPublished={item.publishedAt !== null}
          />
        </Card>
      ) : null}
    </>
  );
}
