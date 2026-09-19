"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { AUTHORING_LOCALES, UI_LOCALE_DIRECTIONS, UI_LOCALE_NAMES, type UiLocale } from "@/modules/account/ui-locales";
import { CEFR_LEVELS, LANGUAGE_SKILLS } from "@/modules/content/levels";
import type { ContentTranslations } from "@/modules/content/package-input";
import type { LocaleText } from "@/modules/plugins/fields";
import {
  createCourse,
  createPackage,
  publishPackage,
  rollbackPackage,
  setContentStatus,
  updateMetadata,
} from "@/server/actions/content";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { fieldCode, formError, formValues } from "@/components/forms/form-state";

/** Forms of the content editor around one server action each. */

function useEditorErrors() {
  const tErrors = useTranslations("editor.errors");
  const tForms = useTranslations("forms.errors");
  return {
    form: (code: string | undefined) =>
      code ? (tErrors.has(code) ? tErrors(code) : tErrors("unexpected")) : undefined,
    field: (code: string | undefined) => (code ? (tForms.has(code) ? tForms(code) : code) : undefined),
  };
}

export interface PluginChoice {
  versionId: string;
  pluginId: string;
  name: LocaleText;
  description: LocaleText;
  templates: { id: string; name: LocaleText; description?: LocaleText }[];
}

export interface PairChoice {
  id: string;
  label: string;
}

function localized(text: LocaleText | undefined, locale: UiLocale): string {
  return text?.[locale] || text?.en || text?.ar || "";
}

/** Interface languages a title or summary may be translated into (the English original is the base, R16). */
const TRANSLATABLE = AUTHORING_LOCALES.filter((locale): locale is "ar" | "fr" => locale !== "en").map((locale) => ({
  locale,
  name: UI_LOCALE_NAMES[locale],
  dir: UI_LOCALE_DIRECTIONS[locale],
}));

/** English title field: Latin script, left-aligned like every Latin-value field (decisions R3, R16). */
function TitleField({
  label,
  hint,
  error,
  defaultValue,
}: {
  label: string;
  hint: string;
  error?: string;
  defaultValue: string;
}) {
  return (
    <Field id="title" label={label} hint={hint} error={error}>
      <input
        id="title"
        name="title"
        className={`${inputClass} field-ltr`}
        lang="en"
        required
        maxLength={200}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy("title", hint, error)}
      />
    </Field>
  );
}

/** Optional translations of the title and summary, collapsed until wanted. */
function TranslationsFields({ initial, t }: { initial: ContentTranslations; t: (key: string) => string }) {
  return (
    <details className="rounded-[var(--radius-card)] border border-line p-4">
      <summary className="cursor-pointer text-sm font-semibold">{t("translationsTitle")}</summary>
      <p className="mt-1 text-xs text-ink-muted">{t("translationsLede")}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {TRANSLATABLE.map(({ locale, name, dir }) => (
          <div key={locale} className="flex flex-col gap-3" dir={dir} lang={locale}>
            <Field id={`title_${locale}`} label={`${t("translatedTitle")} — ${name}`}>
              <input
                id={`title_${locale}`}
                name={`title_${locale}`}
                className={inputClass}
                maxLength={200}
                defaultValue={initial[locale]?.title ?? ""}
              />
            </Field>
            <Field id={`summary_${locale}`} label={`${t("translatedSummary")} — ${name}`}>
              <textarea
                id={`summary_${locale}`}
                name={`summary_${locale}`}
                className={`${inputClass} h-auto min-h-20 py-2`}
                maxLength={2000}
                defaultValue={initial[locale]?.summary ?? ""}
              />
            </Field>
          </div>
        ))}
      </div>
    </details>
  );
}

export function CreatePackageForm({ plugins, pairs }: { plugins: PluginChoice[]; pairs: PairChoice[] }) {
  const locale = useLocale() as UiLocale;
  const t = useTranslations("editor.create");
  const errors = useEditorErrors();
  const [state, action, pending] = useActionState(createPackage.bind(null, locale), idle);
  const values = formValues(state);
  const error = formError(state);
  const [pluginId, setPluginId] = useState(values.plugin ?? plugins[0]?.versionId ?? "");
  const plugin = plugins.find((p) => p.versionId === pluginId) ?? plugins[0];

  return (
    <form action={action} className="flex flex-col gap-4">
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      <Field id="plugin" label={t("plugin")} hint={plugin ? localized(plugin.description, locale) : undefined}>
        <select
          id="plugin"
          name="plugin"
          className={inputClass}
          value={pluginId}
          onChange={(e) => setPluginId(e.target.value)}
          required
        >
          {plugins.map((p) => (
            <option key={p.versionId} value={p.versionId}>
              {localized(p.name, locale)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="pair" label={t("pair")} hint={t("pairHint")}>
        <select id="pair" name="pair" className={inputClass} defaultValue={values.pair ?? pairs[0]?.id ?? ""} required>
          {pairs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="template" label={t("template")} hint={t("templateHint")}>
        <select id="template" name="template" className={inputClass} defaultValue={values.template ?? ""}>
          <option value="">{t("noTemplate")}</option>
          {plugin?.templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {localized(tpl.name, locale)}
              {tpl.description ? ` — ${localized(tpl.description, locale)}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <TitleField
        label={t("title")}
        hint={t("titleHint")}
        error={errors.field(fieldCode(state, "title"))}
        defaultValue={values.title ?? ""}
      />
      <div>
        <Button type="submit" disabled={pending || plugins.length === 0 || pairs.length === 0}>
          {pending ? t("creating") : t("create")}
        </Button>
      </div>
    </form>
  );
}

export function CreateCourseForm({ pairs }: { pairs: PairChoice[] }) {
  const locale = useLocale();
  const t = useTranslations("editor.course");
  const errors = useEditorErrors();
  const [state, action, pending] = useActionState(createCourse.bind(null, locale), idle);
  const values = formValues(state);
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      <Field id="pair" label={t("pair")}>
        <select id="pair" name="pair" className={inputClass} defaultValue={values.pair ?? pairs[0]?.id ?? ""} required>
          {pairs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <TitleField
        label={t("title")}
        hint={t("titleHint")}
        error={errors.field(fieldCode(state, "title"))}
        defaultValue={values.title ?? ""}
      />
      <Field
        id="summary"
        label={t("summary")}
        optionalLabel={t("optional")}
        error={errors.field(fieldCode(state, "summary"))}
      >
        <textarea
          id="summary"
          name="summary"
          className={`${inputClass} h-auto min-h-20 py-2`}
          dir="auto"
          maxLength={2000}
          defaultValue={values.summary ?? ""}
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending || pairs.length === 0}>
          {pending ? t("creating") : t("create")}
        </Button>
      </div>
    </form>
  );
}

export interface MetadataValues {
  title: string;
  summary: string;
  translations: ContentTranslations;
  dialect: string;
  cefr: string;
  cefrSublevel: string;
  skills: string[];
  tags: string;
}

export function MetadataForm({
  itemId,
  initial,
  kind,
}: {
  itemId: string;
  initial: MetadataValues;
  kind: "package" | "course";
}) {
  const locale = useLocale();
  const t = useTranslations("editor.metadata");
  const tSkills = useTranslations("studio.skills");
  const errors = useEditorErrors();
  const [state, action, pending] = useActionState(updateMetadata.bind(null, locale), idle);
  const values = { ...initial, ...formValues(state) };
  const error = formError(state);
  const err = (name: string) => errors.field(fieldCode(state, name));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={itemId} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}
      <TitleField label={t("title")} hint={t("titleHint")} error={err("title")} defaultValue={values.title} />
      <Field
        id="summary"
        label={t("summary")}
        optionalLabel={t("optional")}
        hint={t("summaryHint")}
        error={err("summary")}
      >
        <textarea
          id="summary"
          name="summary"
          className={`${inputClass} h-auto min-h-24 py-2`}
          dir="auto"
          maxLength={2000}
          defaultValue={values.summary}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="dialect"
          label={t("dialect")}
          optionalLabel={t("optional")}
          hint={t("dialectHint")}
          error={err("dialect")}
        >
          <input
            id="dialect"
            name="dialect"
            className={`${inputClass} field-ltr`}
            defaultValue={values.dialect}
            maxLength={40}
          />
        </Field>
        <Field id="cefr" label={t("cefr")} optionalLabel={t("optional")} error={err("cefr")}>
          <select id="cefr" name="cefr" className={inputClass} defaultValue={values.cefr}>
            <option value="">{t("noLevel")}</option>
            {CEFR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="cefrSublevel"
          label={t("cefrSublevel")}
          optionalLabel={t("optional")}
          hint={t("cefrSublevelHint")}
          error={err("cefrSublevel")}
        >
          <select id="cefrSublevel" name="cefrSublevel" className={inputClass} defaultValue={values.cefrSublevel}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {kind === "package" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t("skills")}</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {LANGUAGE_SKILLS.map((skill) => (
              <label key={skill} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="skills"
                  value={skill}
                  className="size-4 accent-accent"
                  defaultChecked={values.skills.includes(skill)}
                />
                {tSkills(skill)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <Field id="tags" label={t("tags")} optionalLabel={t("optional")} hint={t("tagsHint")} error={err("tags")}>
        <input id="tags" name="tags" className={inputClass} dir="auto" defaultValue={values.tags} />
      </Field>
      <TranslationsFields initial={initial.translations} t={t} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

export function PublishForm({ itemId, hasVersion }: { itemId: string; hasVersion: boolean }) {
  const locale = useLocale();
  const t = useTranslations("editor.publish");
  const tIssues = useTranslations("editor.packageIssues");
  const errors = useEditorErrors();
  const [state, action, pending] = useActionState(publishPackage.bind(null, locale), idle);
  const error = formError(state);
  const issues = (formValues(state).issues ?? "").split("\n").filter(Boolean);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={itemId} />
      {error ? (
        <Alert tone="error">
          <span>{errors.form(error)}</span>
          {issues.length > 0 ? (
            <ul className="list-disc ps-5 text-xs">
              {issues.map((issue) => {
                const [code, path] = issue.split(":");
                return (
                  <li key={issue}>
                    {tIssues.has(code) ? tIssues(code) : code}
                    {path ? <code className="field-ltr ms-1 text-[11px] text-ink-muted">{path}</code> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state.status === "ok" ? <Alert tone="success">{t("published")}</Alert> : null}
      <Field id="note" label={t("note")} optionalLabel={t("optional")}>
        <input id="note" name="note" className={inputClass} dir="auto" maxLength={500} />
      </Field>
      <ConfirmSubmit
        key={state.status === "ok" ? "done" : "idle"}
        label={hasVersion ? t("publishAgain") : t("publish")}
        question={t("question")}
        pending={pending}
      />
    </form>
  );
}

export function RollbackForm({
  itemId,
  versionId,
  versionNumber,
}: {
  itemId: string;
  versionId: string;
  versionNumber: number;
}) {
  const locale = useLocale();
  const t = useTranslations("editor.history");
  const errors = useEditorErrors();
  const [state, action, pending] = useActionState(rollbackPackage.bind(null, locale), idle);
  const error = formError(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="version" value={versionId} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("rolledBack")}</Alert> : null}
      <ConfirmSubmit
        key={state.status === "ok" ? "done" : "idle"}
        label={t("rollbackTo", { n: versionNumber })}
        question={t("rollbackQuestion", { n: versionNumber })}
        variant="secondary"
        size="sm"
        pending={pending}
      />
    </form>
  );
}

export function StatusForm({
  itemId,
  status,
  hasVersion,
  everPublished,
}: {
  itemId: string;
  status: string;
  hasVersion: boolean;
  /** Whether the item was published before: the wording says "publish" the first time, "republish" afterwards. */
  everPublished: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("editor.status");
  const errors = useEditorErrors();
  const [state, action, pending] = useActionState(setContentStatus.bind(null, locale), idle);
  const error = formError(state);
  const next = status === "published" ? "archived" : hasVersion ? "published" : null;
  if (!next) return null;
  const publishLabel = everPublished ? t("republish") : t("publish");
  const publishQuestion = everPublished ? t("republishQuestion") : t("publishQuestion");
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="status" value={next} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("changed")}</Alert> : null}
      <ConfirmSubmit
        key={state.status === "ok" ? "done" : "idle"}
        label={next === "archived" ? t("archive") : publishLabel}
        question={next === "archived" ? t("archiveQuestion") : publishQuestion}
        variant="secondary"
        size="sm"
        pending={pending}
      />
    </form>
  );
}
