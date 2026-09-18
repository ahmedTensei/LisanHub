"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { idle } from "@/modules/account/forms";
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/modules/account/schemas";
import { requestPasswordReset, resendConfirmation, signIn, signUp, updatePassword } from "@/server/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field, inputClass } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { fieldCode, formError, formValues } from "./form-state";

const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

function useFormMessages() {
  const tForms = useTranslations("forms");
  const tErrors = useTranslations("forms.errors");
  const tAuthErrors = useTranslations("auth.errors");
  return { tForms, tErrors, tAuthErrors };
}

export function SignUpForm() {
  const locale = useLocale();
  const t = useTranslations("auth.signUp");
  const tForms = useTranslations("forms");
  const { tErrors, tAuthErrors } = useFormMessages();
  const [state, action, pending] = useActionState(signUp.bind(null, locale), idle);
  const values = formValues(state);
  const errors = {
    username: fieldCode(state, "username"),
    displayName: fieldCode(state, "displayName"),
    email: fieldCode(state, "email"),
    password: fieldCode(state, "password"),
  };
  const error = formError(state);
  const hasFieldErrors = Object.values(errors).some(Boolean);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      {!error && hasFieldErrors ? <Alert tone="error">{tForms("fixFields")}</Alert> : null}
      <Field
        id="username"
        label={t("username")}
        hint={t("usernameHint")}
        error={errors.username && tErrors(errors.username)}
      >
        <input
          id="username"
          name="username"
          defaultValue={values.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          placeholder="user_name61"
          className={`${inputClass} field-ltr`}
          aria-invalid={errors.username ? true : undefined}
          aria-describedby={describedBy("username", t("usernameHint"), errors.username)}
        />
      </Field>
      <Field
        id="displayName"
        label={t("displayName")}
        hint={t("displayNameHint")}
        optionalLabel={tForms("optional")}
        error={errors.displayName && tErrors(errors.displayName)}
      >
        <input
          id="displayName"
          name="displayName"
          defaultValue={values.displayName}
          autoComplete="name"
          dir="auto"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          className={inputClass}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={describedBy("displayName", t("displayNameHint"), errors.displayName)}
        />
      </Field>
      <Field id="email" label={t("email")} error={errors.email && tErrors(errors.email)}>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={values.email}
          autoComplete="email"
          required
          placeholder="name@example.com"
          className={`${inputClass} field-ltr`}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email", undefined, errors.email)}
        />
      </Field>
      <Field
        id="password"
        label={t("password")}
        hint={t("passwordHint")}
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
          aria-describedby={describedBy("password", t("passwordHint"), errors.password)}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-sm text-ink-muted">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className={linkClass}>
          {t("signInLink")}
        </Link>
      </p>
    </form>
  );
}

/** "Send the confirmation link again" on the check-email page. */
export function ResendConfirmationForm() {
  const locale = useLocale();
  const t = useTranslations("auth.checkEmail");
  const { tAuthErrors } = useFormMessages();
  const [state, action, pending] = useActionState(() => resendConfirmation(locale), idle);
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.status === "ok" ? <Alert tone="success">{t("resent")}</Alert> : null}
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("resend")}
        </Button>
      </div>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const locale = useLocale();
  const t = useTranslations("auth.signIn");
  const { tErrors, tAuthErrors } = useFormMessages();
  const [state, action, pending] = useActionState(signIn.bind(null, locale), idle);
  const values = formValues(state);
  const errors = { email: fieldCode(state, "email"), password: fieldCode(state, "password") };
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      <Field id="email" label={t("email")} error={errors.email && tErrors(errors.email)}>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={values.email}
          autoComplete="email"
          required
          className={`${inputClass} field-ltr`}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email", undefined, errors.email)}
        />
      </Field>
      <Field id="password" label={t("password")} error={errors.password && tErrors(errors.password)}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={describedBy("password", undefined, errors.password)}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-ink-muted">
        <Link href="/forgot-password" className={linkClass}>
          {t("forgot")}
        </Link>
        <span>
          {t("noAccount")}{" "}
          <Link href="/sign-up" className={linkClass}>
            {t("signUpLink")}
          </Link>
        </span>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const locale = useLocale();
  const t = useTranslations("auth.forgot");
  const { tErrors, tAuthErrors } = useFormMessages();
  const [state, action, pending] = useActionState(requestPasswordReset.bind(null, locale), idle);

  if (state.status === "ok") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          <p className="font-semibold">{t("sentTitle")}</p>
          <p>{t("sentBody")}</p>
        </Alert>
        <Link href="/sign-in" className={`text-sm ${linkClass}`}>
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  const values = formValues(state);
  const emailError = fieldCode(state, "email");
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      <Field id="email" label={t("email")} error={emailError && tErrors(emailError)}>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={values.email}
          autoComplete="email"
          required
          className={`${inputClass} field-ltr`}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy("email", undefined, emailError)}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
      <Link href="/sign-in" className={`text-sm ${linkClass}`}>
        {t("backToSignIn")}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const locale = useLocale();
  const t = useTranslations("auth.reset");
  const tSignUp = useTranslations("auth.signUp");
  const { tErrors, tAuthErrors } = useFormMessages();
  const [state, action, pending] = useActionState(updatePassword.bind(null, locale), idle);
  const errors = { password: fieldCode(state, "password"), confirm: fieldCode(state, "confirm") };
  const error = formError(state);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {error ? <Alert tone="error">{tAuthErrors(error)}</Alert> : null}
      <Field
        id="password"
        label={t("password")}
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
      <Field id="confirm" label={t("confirm")} error={errors.confirm && tErrors(errors.confirm)}>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={describedBy("confirm", undefined, errors.confirm)}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
