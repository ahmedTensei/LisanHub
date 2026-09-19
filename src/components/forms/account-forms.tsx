"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/modules/account/schemas";
import { UI_LOCALE_NAMES, UI_LOCALES } from "@/modules/account/ui-locales";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/modules/support/requests";
import { becomeContentCreator, becomeContributor, updatePreferences, updateProfile } from "@/server/actions/account";
import { changeEmail, changePassword } from "@/server/actions/auth";
import { createSupportRequest } from "@/server/actions/support";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { fieldCode, formError, formValues } from "./form-state";

export function ProfileForm(profile: {
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("account.profile");
  const tForms = useTranslations("forms");
  const tErrors = useTranslations("forms.errors");
  const tAccountErrors = useTranslations("account.errors");
  const [state, action, pending] = useActionState(updateProfile.bind(null, locale), idle);
  const values = formValues(state);
  const errors = {
    username: fieldCode(state, "username"),
    displayName: fieldCode(state, "displayName"),
    bio: fieldCode(state, "bio"),
    location: fieldCode(state, "location"),
  };
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      <Field
        id="username"
        label={t("username")}
        hint={t("usernameHint")}
        error={errors.username && tErrors(errors.username)}
      >
        <input
          id="username"
          name="username"
          defaultValue={values.username ?? profile.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          className={`${inputClass} field-ltr`}
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={describedBy("username", t("usernameHint"), errors.username)}
        />
      </Field>
      <Field
        id="displayName"
        label={t("displayName")}
        hint={t("displayNameHint")}
        error={errors.displayName && tErrors(errors.displayName)}
      >
        <input
          id="displayName"
          name="displayName"
          defaultValue={values.displayName ?? profile.displayName}
          autoComplete="name"
          dir="auto"
          required
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          className={inputClass}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={describedBy("displayName", t("displayNameHint"), errors.displayName)}
        />
      </Field>
      <Field
        id="bio"
        label={t("bio")}
        hint={t("bioHint")}
        optionalLabel={tForms("optional")}
        error={errors.bio && tErrors(errors.bio)}
      >
        <textarea
          id="bio"
          name="bio"
          defaultValue={values.bio ?? profile.bio ?? ""}
          rows={4}
          maxLength={BIO_MAX_LENGTH}
          dir="auto"
          className={`${inputClass} h-auto py-2`}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby={describedBy("bio", t("bioHint"), errors.bio)}
        />
      </Field>
      <Field
        id="location"
        label={t("location")}
        hint={t("locationHint")}
        optionalLabel={tForms("optional")}
        error={errors.location && tErrors(errors.location)}
      >
        <input
          id="location"
          name="location"
          defaultValue={values.location ?? profile.location ?? ""}
          autoComplete="address-level2"
          dir="auto"
          maxLength={LOCATION_MAX_LENGTH}
          className={inputClass}
          aria-invalid={errors.location ? true : undefined}
          aria-describedby={describedBy("location", t("locationHint"), errors.location)}
        />
      </Field>
      <div className="flex">
        <ConfirmSubmit label={t("save")} pending={pending} />
      </div>
    </form>
  );
}

export function PreferencesForm(prefs: { uiLocale: string; visibility: "public" | "restricted" }) {
  const locale = useLocale();
  const t = useTranslations("account.profile");
  const tErrors = useTranslations("forms.errors");
  const tAccountErrors = useTranslations("account.errors");
  const [state, action, pending] = useActionState(updatePreferences.bind(null, locale), idle);
  const errors = { uiLocale: fieldCode(state, "uiLocale"), visibility: fieldCode(state, "visibility") };
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      <Field
        id="uiLocale"
        label={t("uiLocale")}
        hint={t("uiLocaleHint")}
        error={errors.uiLocale && tErrors(errors.uiLocale)}
      >
        <select
          id="uiLocale"
          name="uiLocale"
          defaultValue={prefs.uiLocale}
          className={inputClass}
          aria-describedby={describedBy("uiLocale", t("uiLocaleHint"), errors.uiLocale)}
        >
          {UI_LOCALES.map((l) => (
            <option key={l} value={l} lang={l}>
              {UI_LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{t("visibility")}</legend>
        {(["public", "restricted"] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input
              type="radio"
              name="visibility"
              value={value}
              defaultChecked={prefs.visibility === value}
              className="mt-1.5 accent-accent"
            />
            <span className="flex flex-col">
              <span className="font-semibold">
                {t(value === "public" ? "visibilityPublic" : "visibilityRestricted")}
              </span>
              <span className="text-xs text-ink-muted">
                {t(value === "public" ? "visibilityPublicHint" : "visibilityRestrictedHint")}
              </span>
            </span>
          </label>
        ))}
        {errors.visibility ? (
          <p role="alert" className="text-xs font-semibold text-danger">
            {tErrors(errors.visibility)}
          </p>
        ) : null}
      </fieldset>
      <div className="flex">
        <ConfirmSubmit label={t("save")} pending={pending} />
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const locale = useLocale();
  const t = useTranslations("account.security");
  const tSignUp = useTranslations("auth.signUp");
  const tErrors = useTranslations("forms.errors");
  const tAuthErrors = useTranslations("auth.errors");
  const [state, action, pending] = useActionState(changePassword.bind(null, locale), idle);
  const errors = {
    currentPassword: fieldCode(state, "currentPassword"),
    password: fieldCode(state, "password"),
    confirm: fieldCode(state, "confirm"),
  };
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      <Field
        id="currentPassword"
        label={t("currentPassword")}
        error={errors.currentPassword && tErrors(errors.currentPassword)}
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={describedBy("currentPassword", undefined, errors.currentPassword)}
        />
      </Field>
      <Field
        id="password"
        label={t("newPassword")}
        hint={tSignUp("passwordHint")}
        error={errors.password && tErrors(errors.password)}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={describedBy("password", tSignUp("passwordHint"), errors.password)}
        />
      </Field>
      <Field id="confirm" label={t("confirmPassword")} error={errors.confirm && tErrors(errors.confirm)}>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={describedBy("confirm", undefined, errors.confirm)}
        />
      </Field>
      <div className="flex">
        <ConfirmSubmit label={t("savePassword")} question={t("confirmPassword")} pending={pending} />
      </div>
    </form>
  );
}

export function ChangeEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const locale = useLocale();
  const t = useTranslations("account.security");
  const tErrors = useTranslations("forms.errors");
  const tAuthErrors = useTranslations("auth.errors");
  const [state, action, pending] = useActionState(changeEmail.bind(null, locale), idle);
  const values = formValues(state);
  const emailError = fieldCode(state, "email");
  const error = formError(state);

  if (state.status === "ok") return <Alert tone="success">{t("emailChangeSent")}</Alert>;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      <p className="text-sm text-ink-muted">
        {t("currentEmail")}: <span dir="ltr">{currentEmail}</span>
      </p>
      <Field id="newEmail" label={t("newEmail")} hint={t("newEmailHint")} error={emailError && tErrors(emailError)}>
        <input
          id="newEmail"
          name="email"
          type="email"
          defaultValue={values.email}
          autoComplete="email"
          required
          className={`${inputClass} field-ltr`}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy("newEmail", t("newEmailHint"), emailError)}
        />
      </Field>
      <div className="flex">
        <ConfirmSubmit label={t("changeEmail")} question={t("confirmEmail")} variant="secondary" pending={pending} />
      </div>
    </form>
  );
}

/** One explicit confirmation: an acknowledgement box the server verifies, then the switch. */
export function BecomeCreatorForm() {
  const locale = useLocale();
  const t = useTranslations("account.creator");
  const tAccountErrors = useTranslations("account.errors");
  const [state, action, pending] = useActionState(becomeContentCreator.bind(null, locale), idle);
  const error = formError(state);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-line bg-paper p-4"
    >
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="acknowledge" required className="mt-1 size-4 accent-accent" />
        <span>{t("acknowledge")}</span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("confirming") : t("confirm")}
        </Button>
      </div>
    </form>
  );
}

export function BecomeContributorForm() {
  const locale = useLocale();
  const t = useTranslations("account.contributor");
  const tAccountErrors = useTranslations("account.errors");
  const [state, action, pending] = useActionState(becomeContributor.bind(null, locale), idle);
  const error = formError(state);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-line bg-paper p-4"
    >
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="acknowledge" required className="mt-1 size-4 accent-accent" />
        <span>{t("acknowledge")}</span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("confirming") : t("confirm")}
        </Button>
      </div>
    </form>
  );
}

/** Writing to support from the platform; `kind` is fixed by the page that shows the form. */
export function SupportRequestForm({ kind }: { kind: "revert_to_student" | "other" }) {
  const locale = useLocale();
  const t = useTranslations("account.support");
  const tAccountErrors = useTranslations("account.errors");
  const [state, action, pending] = useActionState(createSupportRequest.bind(null, locale), idle);
  const values = formValues(state);
  const error = formError(state);

  if (state.status === "ok") return <Alert tone="success">{t("sent")}</Alert>;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="kind" value={kind} />
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      <Field id="supportMessage" label={t("message")} hint={t(`hints.${kind}`)}>
        <textarea
          id="supportMessage"
          name="message"
          defaultValue={values.message}
          rows={4}
          maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
          dir="auto"
          className={`${inputClass} h-auto py-2`}
          aria-describedby={describedBy("supportMessage", t(`hints.${kind}`))}
        />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t(`submit.${kind}`)}
        </Button>
      </div>
    </form>
  );
}
