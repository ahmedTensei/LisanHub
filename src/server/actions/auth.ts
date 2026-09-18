"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issuesToFieldErrors, keepValues, safeNextPath, type FormState } from "@/modules/account/forms";
import {
  ChangeEmailInput,
  ChangePasswordInput,
  NewPasswordInput,
  PasswordResetRequestInput,
  SignInInput,
  SignUpInput,
} from "@/modules/account/schemas";
import { isUiLocale } from "@/modules/account/ui-locales";
import { getSession } from "@/server/actor";
import { readPendingEmail, rememberPendingEmail } from "@/server/pending-email";
import { siteOrigin } from "@/server/site-url";

/**
 * Account actions backed by Supabase Auth (email + password, confirmation and
 * recovery by email). Google sign-in is deferred. Every action validates its
 * input, never trusts ids from the browser and maps provider errors to
 * translatable codes (`auth.errors.*`). Submitted values (never passwords) are
 * returned with errors so the form can be re-filled.
 */

function authErrorCode(error: { code?: string; status?: number } | null): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "user_already_exists":
    case "email_exists":
      return "email_exists";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    case "signup_disabled":
      return "signup_disabled";
    default:
      return error?.status === 429 ? "rate_limited" : "unexpected";
  }
}

function localeOf(value: string): string {
  return isUiLocale(value) ? value : "ar";
}

export async function signUp(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const values = keepValues(formData, ["username", "displayName", "email"]);
  const parsed = SignUpInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    uiLocale,
  });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const availability = await supabase.rpc("username_available", { p_username: parsed.data.username });
  if (availability.error) return { status: "error", error: "unexpected", values };
  if (!availability.data) return { status: "error", fieldErrors: { username: "username_taken" }, values };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the database trigger that creates the Student profile.
      data: {
        username: parsed.data.username,
        display_name: parsed.data.displayName ?? parsed.data.username,
        ui_locale: parsed.data.uiLocale,
      },
      emailRedirectTo: `${await siteOrigin()}/${uiLocale}/auth/confirm`,
    },
  });
  if (error) {
    // The profile trigger rejects a username taken between the check and the insert.
    if (/database error/i.test(error.message)) {
      return { status: "error", fieldErrors: { username: "username_taken" }, values };
    }
    const code = authErrorCode(error);
    if (code === "email_exists") return { status: "error", fieldErrors: { email: "email_exists" }, values };
    return { status: "error", error: code, values };
  }

  // With confirmations enabled Supabase answers an already-registered, confirmed
  // address with an identity-less user instead of an error. Ahmed asked for an
  // explicit message here (2026-09-17), accepting that it reveals the account exists.
  if (data.user && data.user.identities?.length === 0) {
    return { status: "error", fieldErrors: { email: "email_exists" }, values };
  }

  if (data.session) redirect(`/${uiLocale}/account?notice=welcome`);

  await rememberPendingEmail(parsed.data.email);
  redirect(`/${uiLocale}/sign-up/check-email`);
}

/** Sends the confirmation link again to the address kept from sign-up. */
export async function resendConfirmation(locale: string): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const email = await readPendingEmail();
  if (!email) redirect(`/${uiLocale}/sign-up`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/${uiLocale}/auth/confirm` },
  });
  if (error) return { status: "error", error: authErrorCode(error) };
  return { status: "ok", outcome: "resent" };
}

export async function signIn(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const values = keepValues(formData, ["email"]);
  const parsed = SignInInput.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", error: authErrorCode(error), values };

  const requested = formData.get("next");
  if (typeof requested === "string" && requested !== "") {
    redirect(safeNextPath(requested, `/${uiLocale}/account`));
  }
  // No explicit destination: land in the interface language saved in the profile.
  const profile = await supabase.from("profiles").select("ui_locale").eq("id", data.user.id).maybeSingle();
  redirect(`/${localeOf(profile.data?.ui_locale ?? uiLocale)}/account`);
}

export async function signOut(locale: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${localeOf(locale)}`);
}

export async function requestPasswordReset(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const values = keepValues(formData, ["email"]);
  const parsed = PasswordResetRequestInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const next = encodeURIComponent(`/${uiLocale}/reset-password`);
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/${uiLocale}/auth/confirm?next=${next}`,
  });
  // Unknown addresses get the same answer as known ones.
  if (error && authErrorCode(error) === "rate_limited") return { status: "error", error: "rate_limited", values };
  return { status: "ok", outcome: "check_email" };
}

/** Signed-in password change: the current password is verified first, then replaced. */
export async function changePassword(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor, email } = await getSession();
  if (actor.kind !== "user" || !email) return { status: "error", error: "sign_in_required" };

  const parsed = ChangePasswordInput.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues) };

  const supabase = await createSupabaseServerClient();
  const check = await supabase.auth.signInWithPassword({ email, password: parsed.data.currentPassword });
  if (check.error) return { status: "error", fieldErrors: { currentPassword: "current_password_wrong" } };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", error: authErrorCode(error) };
  redirect(`/${uiLocale}/account/security?notice=password_updated`);
}

/** Starts an email change: Supabase asks both addresses to confirm (double confirmation is on). */
export async function changeEmail(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor, email: current } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };

  const values = keepValues(formData, ["email"]);
  const parsed = ChangeEmailInput.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };
  if (current && parsed.data.email.toLowerCase() === current.toLowerCase()) {
    return { status: "error", fieldErrors: { email: "email_same" }, values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await siteOrigin()}/${uiLocale}/auth/confirm` },
  );
  if (error) {
    const code = authErrorCode(error);
    if (code === "email_exists") return { status: "error", fieldErrors: { email: "email_exists" }, values };
    return { status: "error", error: code, values };
  }
  return { status: "ok", outcome: "email_change_sent" };
}

export async function updatePassword(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };

  const parsed = NewPasswordInput.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", error: authErrorCode(error) };
  redirect(`/${uiLocale}/account?notice=password_updated`);
}
