import { z } from "zod";
import { DIALECT_TAG_MAX_LENGTH, DIALECT_TAG_PATTERN, LANGUAGE_CODE_PATTERN } from "@/modules/languages/language-pair";
import { UI_LOCALES } from "./ui-locales";

/**
 * Input rules for account forms. Every message is a code from FORM_ERROR_CODES,
 * translated by the interface (`messages/*.json`, namespace `forms.errors`).
 * Password policy decided by Ahmed (2026-09-17): at least 8 characters, no
 * complexity rules. Supabase enforces the same minimum server-side.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const DISPLAY_NAME_MAX_LENGTH = 60;
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 30;
/** Letters, digits, underscore and dot; starts with a letter or digit. Uniqueness is case-insensitive (database). */
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.]{3,29}$/;
export const GOAL_MAX_LENGTH = 200;

export const FORM_ERROR_CODES = [
  "required",
  "email_invalid",
  "password_too_short",
  "password_too_long",
  "passwords_differ",
  "username_too_short",
  "username_too_long",
  "username_invalid",
  "username_taken",
  "email_exists",
  "email_same",
  "current_password_wrong",
  "display_name_too_long",
  "ui_locale_invalid",
  "visibility_invalid",
  "language_invalid",
  "same_language",
  "dialect_invalid",
  "goal_too_long",
  "bio_too_long",
  "location_too_long",
  "avatar_type_invalid",
  "avatar_too_large",
  // Generic codes of the studio and the content editor (S2).
  "invalid",
  "too_short",
  "too_long",
  "too_few",
  "too_many",
  "slug_invalid",
  "slug_taken",
  "version_invalid",
  "json_invalid",
  "schema_invalid",
  "correct_missing",
  "duplicate_option",
  "blank_count",
  "asset_required",
  "title_too_long",
  "title_latin_required",
  "summary_too_long",
  "tag_invalid",
  "cefr_invalid",
  "skill_invalid",
] as const;
export type FormErrorCode = (typeof FORM_ERROR_CODES)[number];

const code = (c: FormErrorCode) => ({ error: c });

export const Email = z
  .string(code("required"))
  .trim()
  .pipe(z.email(code("email_invalid")).max(254, code("email_invalid")));

export const Password = z
  .string(code("required"))
  .min(PASSWORD_MIN_LENGTH, code("password_too_short"))
  .max(PASSWORD_MAX_LENGTH, code("password_too_long"));

export const Username = z
  .string(code("required"))
  .trim()
  .min(1, code("required"))
  .min(USERNAME_MIN_LENGTH, code("username_too_short"))
  .max(USERNAME_MAX_LENGTH, code("username_too_long"))
  .regex(USERNAME_PATTERN, code("username_invalid"));

/** Free-form name shown to people, any script. Required on the profile; optional at sign-up (defaults to the username). */
export const DisplayName = z
  .string(code("required"))
  .trim()
  .min(1, code("required"))
  .max(DISPLAY_NAME_MAX_LENGTH, code("display_name_too_long"));

const OptionalDisplayName = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  DisplayName.optional(),
);

export const UiLocaleSchema = z.enum(UI_LOCALES, code("ui_locale_invalid"));

export const ProfileVisibility = z.enum(["public", "restricted"], code("visibility_invalid"));
export type ProfileVisibility = z.infer<typeof ProfileVisibility>;

export const SignUpInput = z.object({
  email: Email,
  password: Password,
  username: Username,
  displayName: OptionalDisplayName,
  uiLocale: UiLocaleSchema,
});
export type SignUpInput = z.infer<typeof SignUpInput>;

export const SignInInput = z.object({
  email: Email,
  password: z.string(code("required")).min(1, code("required")),
});
export type SignInInput = z.infer<typeof SignInInput>;

export const PasswordResetRequestInput = z.object({ email: Email });

export const NewPasswordInput = z
  .object({ password: Password, confirm: z.string(code("required")) })
  .refine((v) => v.password === v.confirm, { ...code("passwords_differ"), path: ["confirm"] });
export type NewPasswordInput = z.infer<typeof NewPasswordInput>;

export const BIO_MAX_LENGTH = 500;
export const LOCATION_MAX_LENGTH = 80;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const OptionalLine = (max: number, c: FormErrorCode) =>
  z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : typeof v === "string" ? v.trim() : v),
    z.string().max(max, code(c)).nullable(),
  );

export const ProfileUpdateInput = z.object({
  username: Username,
  displayName: DisplayName,
  bio: OptionalLine(BIO_MAX_LENGTH, "bio_too_long"),
  location: OptionalLine(LOCATION_MAX_LENGTH, "location_too_long"),
});

/** Checks an uploaded picture before it reaches storage: type and size only (the image itself is never executed). */
export function validateAvatar(file: { type: string; size: number }): FormErrorCode | null {
  if (!(AVATAR_CONTENT_TYPES as readonly string[]).includes(file.type)) return "avatar_type_invalid";
  if (file.size === 0) return "required";
  if (file.size > AVATAR_MAX_BYTES) return "avatar_too_large";
  return null;
}
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInput>;

export const PreferencesInput = z.object({
  uiLocale: UiLocaleSchema,
  visibility: ProfileVisibility,
});
export type PreferencesInput = z.infer<typeof PreferencesInput>;

export const ChangePasswordInput = z
  .object({
    currentPassword: z.string(code("required")).min(1, code("required")),
    password: Password,
    confirm: z.string(code("required")),
  })
  .refine((v) => v.password === v.confirm, { ...code("passwords_differ"), path: ["confirm"] });
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const ChangeEmailInput = z.object({ email: Email });

/** Turns free text such as "Algerian Arabic " into the stored tag "algerian-arabic"; empty input means no dialect. */
export function normalizeDialectTag(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const tag = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return tag === "" ? undefined : tag;
}

const OptionalText = (max: number, c: FormErrorCode) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
    z.string().max(max, code(c)).optional(),
  );

const Language = z.string(code("language_invalid")).regex(LANGUAGE_CODE_PATTERN, code("language_invalid"));

const Dialect = z.preprocess(
  normalizeDialectTag,
  z
    .string()
    .regex(DIALECT_TAG_PATTERN, code("dialect_invalid"))
    .max(DIALECT_TAG_MAX_LENGTH, code("dialect_invalid"))
    .optional(),
);

export const LanguagePairInput = z
  .object({
    native: Language,
    target: Language,
    dialect: Dialect,
    goal: OptionalText(GOAL_MAX_LENGTH, "goal_too_long"),
  })
  .refine((v) => v.native !== v.target, { ...code("same_language"), path: ["target"] });
export type LanguagePairInput = z.infer<typeof LanguagePairInput>;
