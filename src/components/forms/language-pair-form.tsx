"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { GOAL_MAX_LENGTH } from "@/modules/account/schemas";
import { DIALECT_TAG_MAX_LENGTH } from "@/modules/languages/language-pair";
import { addLanguagePair } from "@/server/actions/account";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { fieldCode, formError, formValues } from "./form-state";
import { LanguagePicker } from "./language-picker";

export function LanguagePairForm() {
  const locale = useLocale();
  const t = useTranslations("languages.add");
  const tForms = useTranslations("forms");
  const tErrors = useTranslations("forms.errors");
  const tAccountErrors = useTranslations("account.errors");
  const [state, action, pending] = useActionState(addLanguagePair.bind(null, locale), idle);
  const values = formValues(state);
  const errors = {
    native: fieldCode(state, "native"),
    target: fieldCode(state, "target"),
    dialect: fieldCode(state, "dialect"),
    goal: fieldCode(state, "goal"),
  };
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate key={state.status === "ok" ? "reset" : "edit"}>
      {state.status === "ok" ? <Alert tone="success">{t("added")}</Alert> : null}
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      <Field id="native" label={t("native")} hint={t("nativeHint")} error={errors.native && tErrors(errors.native)}>
        <LanguagePicker
          name="native"
          inputId="native"
          invalid={Boolean(errors.native)}
          describedBy={describedBy("native", t("nativeHint"), errors.native)}
        />
      </Field>
      <Field id="target" label={t("target")} error={errors.target && tErrors(errors.target)}>
        <LanguagePicker
          name="target"
          inputId="target"
          invalid={Boolean(errors.target)}
          describedBy={describedBy("target", undefined, errors.target)}
        />
      </Field>
      <Field
        id="dialect"
        label={t("dialect")}
        hint={t("dialectHint")}
        optionalLabel={tForms("optional")}
        error={errors.dialect && tErrors(errors.dialect)}
      >
        <input
          id="dialect"
          name="dialect"
          defaultValue={values.dialect}
          maxLength={DIALECT_TAG_MAX_LENGTH}
          className={`${inputClass} field-ltr`}
          aria-invalid={errors.dialect ? true : undefined}
          aria-describedby={describedBy("dialect", t("dialectHint"), errors.dialect)}
        />
      </Field>
      <Field
        id="goal"
        label={t("goal")}
        hint={t("goalHint")}
        optionalLabel={tForms("optional")}
        error={errors.goal && tErrors(errors.goal)}
      >
        <input
          id="goal"
          name="goal"
          defaultValue={values.goal}
          dir="auto"
          maxLength={GOAL_MAX_LENGTH}
          className={inputClass}
          aria-invalid={errors.goal ? true : undefined}
          aria-describedby={describedBy("goal", t("goalHint"), errors.goal)}
        />
      </Field>
      <div className="flex">
        <ConfirmSubmit label={t("submit")} pending={pending} />
      </div>
    </form>
  );
}
