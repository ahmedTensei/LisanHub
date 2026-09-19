"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import type { UiLocale } from "@/modules/account/ui-locales";
import { LANGUAGE_SKILLS } from "@/modules/content/levels";
import type { AuthoringActivity } from "@/modules/plugins/generate";
import { saveContentItem, uploadItemImage } from "@/server/actions/content";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { fieldCode, formError } from "@/components/forms/form-state";
import { ItemForm, type AssetOption } from "./item-form";

/**
 * Edits one item of a package: the generated form for its fields, a picture
 * upload per image field (the picture goes into the package, never a link),
 * and one explicit save. The item id never changes.
 */
export function ContentItemEditor({
  packageId,
  itemId,
  activity,
  initialFields,
  initialSkill,
  assets,
}: {
  packageId: string;
  itemId: string;
  activity: AuthoringActivity;
  initialFields: Record<string, unknown>;
  initialSkill: string | undefined;
  assets: AssetOption[];
}) {
  const locale = useLocale() as UiLocale;
  const t = useTranslations("editor.itemEditor");
  const tSkills = useTranslations("studio.skills");
  const tErrors = useTranslations("editor.errors");
  const [fields, setFields] = useState<Record<string, unknown>>(initialFields);
  const [skill, setSkill] = useState(initialSkill ?? activity.skill);
  const [state, action, pending] = useActionState(saveContentItem.bind(null, locale), idle);
  const error = formError(state);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const imageFields = activity.fields.filter((f) => f.type === "image");

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={packageId} />
        <input type="hidden" name="item" value={itemId} />
        <input type="hidden" name="payload" value={JSON.stringify(fields)} />
        {error ? <Alert tone="error">{tErrors.has(error) ? tErrors(error) : tErrors("unexpected")}</Alert> : null}
        {state.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}
        <ItemForm
          activity={activity}
          locale={locale}
          value={fields}
          onChange={setFields}
          assets={assets}
          errors={fieldErrors}
          idPrefix={`item-${itemId}`}
        />
        <Field id="skill" label={t("skill")} hint={t("skillHint")}>
          <select
            id="skill"
            name="skill"
            className={inputClass}
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            {LANGUAGE_SKILLS.map((s) => (
              <option key={s} value={s}>
                {tSkills(s)}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>

      {imageFields.map((field) => (
        <ImageUploadForm
          key={field.key}
          packageId={packageId}
          itemId={itemId}
          fieldKey={field.key}
          label={field.label[locale] || field.key}
        />
      ))}
    </div>
  );
}

function ImageUploadForm({
  packageId,
  itemId,
  fieldKey,
  label,
}: {
  packageId: string;
  itemId: string;
  fieldKey: string;
  label: string;
}) {
  const locale = useLocale();
  const t = useTranslations("editor.itemEditor");
  const tForms = useTranslations("forms.errors");
  const tErrors = useTranslations("editor.errors");
  const [state, action, pending] = useActionState(uploadItemImage.bind(null, locale), idle);
  const error = formError(state);
  const fileError = fieldCode(state, "file");
  const altError = fieldCode(state, "alt");

  return (
    <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
      <input type="hidden" name="id" value={packageId} />
      <input type="hidden" name="item" value={itemId} />
      <input type="hidden" name="field" value={fieldKey} />
      <h3 className="text-sm font-bold">{t("uploadTitle", { field: label })}</h3>
      <p className="text-xs text-ink-muted">{t("uploadLede")}</p>
      {error ? <Alert tone="error">{tErrors.has(error) ? tErrors(error) : tErrors("unexpected")}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("imageAdded")}</Alert> : null}
      <Field id={`file-${fieldKey}`} label={t("file")} error={fileError ? tForms(fileError) : undefined}>
        <input
          id={`file-${fieldKey}`}
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="text-sm"
          required
        />
      </Field>
      <Field
        id={`alt-${fieldKey}`}
        label={t("alt")}
        hint={t("altHint")}
        error={altError ? tForms(altError) : undefined}
      >
        <input id={`alt-${fieldKey}`} name="alt" className={inputClass} dir="auto" maxLength={300} required />
      </Field>
      <div>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? t("uploading") : t("upload")}
        </Button>
      </div>
    </form>
  );
}
