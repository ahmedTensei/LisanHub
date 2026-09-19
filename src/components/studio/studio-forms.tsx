"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { AUTHORING_LOCALES, UI_LOCALE_DIRECTIONS, UI_LOCALE_NAMES, type UiLocale } from "@/modules/account/ui-locales";
import type { PluginDraft } from "@/modules/plugins/contract";
import {
  createPlugin,
  deletePluginDraft,
  savePluginAdvanced,
  savePluginInfo,
  submitPluginVersion,
} from "@/server/actions/studio";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { fieldCode, formError, formValues } from "@/components/forms/form-state";

/** Small forms of the studio around one server action each; the composed editors live in their own files. */

/**
 * Names and descriptions are written in English first (decision R16); the
 * other interface languages are optional translations shown in their place.
 */
const NAME_LOCALES: { locale: UiLocale; name: string; dir: "ltr" | "rtl" }[] = AUTHORING_LOCALES.map((locale) => ({
  locale,
  name: UI_LOCALE_NAMES[locale],
  dir: UI_LOCALE_DIRECTIONS[locale],
}));

function useStudioErrors() {
  const tErrors = useTranslations("studio.errors");
  const tForms = useTranslations("forms.errors");
  return {
    form: (code: string | undefined) =>
      code ? (tErrors.has(code) ? tErrors(code) : tErrors("unexpected")) : undefined,
    field: (code: string | undefined) => (code ? (tForms.has(code) ? tForms(code) : code) : undefined),
  };
}

export function CreatePluginForm() {
  const locale = useLocale();
  const t = useTranslations("studio.create");
  const errors = useStudioErrors();
  const [state, action, pending] = useActionState(createPlugin.bind(null, locale), idle);
  const values = formValues(state);
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      <Field
        id="plugin_id"
        label={t("pluginId")}
        hint={t("pluginIdHint")}
        error={errors.field(fieldCode(state, "plugin_id"))}
      >
        <input
          id="plugin_id"
          name="plugin_id"
          required
          className={`${inputClass} field-ltr`}
          defaultValue={values.plugin_id ?? ""}
          placeholder="complete-the-dialogue"
          aria-invalid={fieldCode(state, "plugin_id") ? true : undefined}
          aria-describedby={describedBy("plugin_id", t("pluginIdHint"), errors.field(fieldCode(state, "plugin_id")))}
        />
      </Field>
      {NAME_LOCALES.map(({ locale: l, name: languageName, dir }) => (
        <Field
          key={l}
          id={`name_${l}`}
          label={`${t("name")} — ${languageName}`}
          optionalLabel={l === "en" ? undefined : t("optional")}
          hint={l === "en" ? t("nameHint") : undefined}
          error={errors.field(fieldCode(state, `name_${l}`))}
        >
          <input
            id={`name_${l}`}
            name={`name_${l}`}
            className={inputClass}
            dir={dir}
            lang={l}
            required={l === "en"}
            defaultValue={values[`name_${l}`] ?? ""}
            aria-invalid={fieldCode(state, `name_${l}`) ? true : undefined}
          />
        </Field>
      ))}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </Button>
      </div>
    </form>
  );
}

export function PluginInfoForm({ pluginRowId, draft }: { pluginRowId: string; draft: PluginDraft }) {
  const locale = useLocale();
  const t = useTranslations("studio.info");
  const errors = useStudioErrors();
  const [state, action, pending] = useActionState(savePluginInfo.bind(null, locale), idle);
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={pluginRowId} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}
      <p className="text-xs text-ink-muted">{t("englishFirst")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {NAME_LOCALES.map(({ locale: l, name: languageName, dir }) => (
          <Field
            key={`name_${l}`}
            id={`name_${l}`}
            label={`${t("name")} — ${languageName}`}
            optionalLabel={l === "en" ? undefined : t("optional")}
          >
            <input
              id={`name_${l}`}
              name={`name_${l}`}
              className={inputClass}
              dir={dir}
              lang={l}
              required={l === "en"}
              defaultValue={draft.name[l] ?? ""}
            />
          </Field>
        ))}
        {NAME_LOCALES.map(({ locale: l, name: languageName, dir }) => (
          <Field
            key={`description_${l}`}
            id={`description_${l}`}
            label={`${t("description")} — ${languageName}`}
            optionalLabel={l === "en" ? undefined : t("optional")}
          >
            <textarea
              id={`description_${l}`}
              name={`description_${l}`}
              className={`${inputClass} h-auto min-h-20 py-2`}
              dir={dir}
              lang={l}
              required={l === "en"}
              defaultValue={draft.description[l] ?? ""}
            />
          </Field>
        ))}
        <Field
          id="version"
          label={t("version")}
          hint={t("versionHint")}
          error={errors.field(fieldCode(state, "version"))}
        >
          <input id="version" name="version" className={`${inputClass} field-ltr`} defaultValue={draft.version} />
        </Field>
        <Field
          id="schema_version"
          label={t("schemaVersion")}
          hint={t("schemaVersionHint")}
          error={errors.field(fieldCode(state, "schema_version"))}
        >
          <input
            id="schema_version"
            name="schema_version"
            type="number"
            min={1}
            className={`${inputClass} field-ltr`}
            defaultValue={draft.schema_version}
          />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="assets_image"
          className="size-4 accent-accent"
          defaultChecked={draft.assets_allowed.includes("image")}
        />
        {t("allowImages")}
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

export function AdvancedSchemaForm({ pluginRowId, draft }: { pluginRowId: string; draft: PluginDraft }) {
  const locale = useLocale();
  const t = useTranslations("studio.advanced");
  const errors = useStudioErrors();
  const [state, action, pending] = useActionState(savePluginAdvanced.bind(null, locale), idle);
  const error = formError(state);
  const values = formValues(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={pluginRowId} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="custom" className="size-4 accent-accent" defaultChecked={draft.custom_schema} />
        {t("useCustom")}
      </label>
      <Field id="schema" label={t("schema")} hint={t("schemaHint")} error={errors.field(fieldCode(state, "schema"))}>
        <textarea
          id="schema"
          name="schema"
          className={`${inputClass} field-ltr h-auto min-h-64 py-2 font-mono text-xs`}
          defaultValue={values.schema ?? (draft.content_schema ? JSON.stringify(draft.content_schema, null, 2) : "")}
          spellCheck={false}
        />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

export function SubmitVersionForm({
  pluginRowId,
  version,
  direct,
}: {
  pluginRowId: string;
  version: string;
  direct: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("studio.publish");
  const errors = useStudioErrors();
  const [state, action, pending] = useActionState(submitPluginVersion.bind(null, locale), idle);
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={pluginRowId} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      {state.status === "ok" && state.outcome ? <Alert tone="success">{t(`outcomes.${state.outcome}`)}</Alert> : null}
      <Field id="note" label={t("note")} optionalLabel={t("optional")}>
        <input id="note" name="note" className={inputClass} dir="auto" maxLength={500} />
      </Field>
      {/* A successful submission disarms the confirmation; the version label always comes from the draft. */}
      <ConfirmSubmit
        key={`${version}-${state.status === "ok" ? "done" : "idle"}`}
        label={direct ? t("publishVersion", { version }) : t("requestVersion", { version })}
        question={direct ? t("publishQuestion") : t("requestQuestion")}
        pending={pending}
      />
    </form>
  );
}

export function DeleteDraftForm({ pluginRowId }: { pluginRowId: string }) {
  const locale = useLocale();
  const t = useTranslations("studio.overview");
  const errors = useStudioErrors();
  const [state, action, pending] = useActionState(deletePluginDraft.bind(null, locale), idle);
  const error = formError(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={pluginRowId} />
      {error ? <Alert tone="error">{errors.form(error)}</Alert> : null}
      <ConfirmSubmit
        label={t("deleteDraft")}
        question={t("deleteQuestion")}
        variant="danger"
        size="sm"
        pending={pending}
      />
    </form>
  );
}
