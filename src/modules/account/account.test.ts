import { describe, expect, it } from "vitest";
import { issuesToFieldErrors, keepValues, maskEmail, safeNextPath } from "./forms";
import {
  FORM_ERROR_CODES,
  LanguagePairInput,
  NewPasswordInput,
  PreferencesInput,
  ProfileUpdateInput,
  SignUpInput,
  normalizeDialectTag,
  validateAvatar,
} from "./schemas";
import { UI_LOCALES, isUiLocale } from "./ui-locales";

describe("sign-up rules", () => {
  it("accepts an 8-character password without complexity rules (Ahmed, 2026-09-17)", () => {
    const parsed = SignUpInput.safeParse({
      email: " Amel@Example.com ",
      password: "abcdefgh",
      username: " amel_2026 ",
      uiLocale: "ar",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({ email: "Amel@Example.com", username: "amel_2026" });
      expect(parsed.data.displayName).toBeUndefined();
    }
    const named = SignUpInput.safeParse({
      email: "a@b.co",
      password: "abcdefgh",
      username: "amel_2026",
      displayName: " أمل بن يوسف ",
      uiLocale: "ar",
    });
    expect(named.success && named.data.displayName).toBe("أمل بن يوسف");
  });

  it("reports one translatable code per field", () => {
    const parsed = SignUpInput.safeParse({ email: "not-an-email", password: "short", username: "", uiLocale: "xx" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(issuesToFieldErrors(parsed.error.issues)).toEqual({
        email: "email_invalid",
        password: "password_too_short",
        username: "required",
        uiLocale: "ui_locale_invalid",
      });
    }
  });

  it("requires a username of 4 to 30 handle characters", () => {
    const codeFor = (username: string) => {
      const parsed = SignUpInput.safeParse({ email: "a@b.co", password: "abcdefgh", username, uiLocale: "ar" });
      return parsed.success ? null : issuesToFieldErrors(parsed.error.issues).username;
    };
    expect(codeFor("Ahmed_1")).toBeNull();
    expect(codeFor("abc")).toBe("username_too_short");
    expect(codeFor("a".repeat(31))).toBe("username_too_long");
    expect(codeFor("ahmed hayani")).toBe("username_invalid");
    expect(codeFor("أحمد٢٠٢٦")).toBe("username_invalid");
    expect(codeFor(".ahmed")).toBe("username_invalid");
  });

  it("only uses error codes from the published list", () => {
    const parsed = NewPasswordInput.safeParse({ password: "abcdefgh", confirm: "abcdefgX" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) expect(FORM_ERROR_CODES).toContain(issue.message);
      expect(issuesToFieldErrors(parsed.error.issues)).toEqual({ confirm: "passwords_differ" });
    }
  });
});

describe("profile rules", () => {
  it("accepts public and restricted visibility only", () => {
    expect(PreferencesInput.safeParse({ uiLocale: "fr", visibility: "restricted" }).success).toBe(true);
    const bad = PreferencesInput.safeParse({ uiLocale: "fr", visibility: "hidden" });
    expect(ProfileUpdateInput.safeParse({ username: "amel", displayName: "Amel" }).success).toBe(true);
    const full = ProfileUpdateInput.safeParse({
      username: "amel",
      displayName: "Amel",
      bio: " متعلّمة من وهران ",
      location: "",
    });
    expect(full.success && full.data).toEqual({
      username: "amel",
      displayName: "Amel",
      bio: "متعلّمة من وهران",
      location: null,
    });
    const long = ProfileUpdateInput.safeParse({ username: "amel", displayName: "Amel", bio: "x".repeat(501) });
    expect(!long.success && issuesToFieldErrors(long.error.issues)).toEqual({ bio: "bio_too_long" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(issuesToFieldErrors(bad.error.issues)).toEqual({ visibility: "visibility_invalid" });
  });

  it("keeps interface locales separate from learning languages", () => {
    expect([...UI_LOCALES]).toEqual(["ar", "fr", "en"]);
    expect(isUiLocale("kab")).toBe(false);
  });
});

describe("profile picture rules", () => {
  it("accepts small JPEG, PNG and WebP files only", () => {
    expect(validateAvatar({ type: "image/webp", size: 120_000 })).toBeNull();
    expect(validateAvatar({ type: "image/svg+xml", size: 1000 })).toBe("avatar_type_invalid");
    expect(validateAvatar({ type: "image/png", size: 3 * 1024 * 1024 })).toBe("avatar_too_large");
    expect(validateAvatar({ type: "image/png", size: 0 })).toBe("required");
  });
});

describe("language pair rules", () => {
  it("normalizes a dialect typed as free text into a tag", () => {
    expect(normalizeDialectTag(" Algerian  Arabic ")).toBe("algerian-arabic");
    expect(normalizeDialectTag("dz_oran!")).toBe("dz-oran");
    expect(normalizeDialectTag("   ")).toBeUndefined();
    expect(normalizeDialectTag(undefined)).toBeUndefined();
  });

  it("accepts a pair with optional dialect and goal", () => {
    const parsed = LanguagePairInput.safeParse({
      native: "arq",
      target: "fra",
      dialect: "Paris",
      goal: "  Work in Lyon ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toEqual({ native: "arq", target: "fra", dialect: "paris", goal: "Work in Lyon" });

    const bare = LanguagePairInput.safeParse({ native: "kab", target: "eng", dialect: "", goal: "" });
    expect(bare.success).toBe(true);
    if (bare.success) expect(bare.data).toEqual({ native: "kab", target: "eng", dialect: undefined, goal: undefined });
  });

  it("rejects the same language on both sides and malformed codes", () => {
    const same = LanguagePairInput.safeParse({ native: "fra", target: "fra" });
    expect(same.success).toBe(false);
    if (!same.success) expect(issuesToFieldErrors(same.error.issues)).toEqual({ target: "same_language" });

    const bad = LanguagePairInput.safeParse({ native: "fr", target: "français", goal: "x".repeat(201) });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(issuesToFieldErrors(bad.error.issues)).toEqual({
        native: "language_invalid",
        target: "language_invalid",
        goal: "goal_too_long",
      });
    }
  });
});

describe("form helpers", () => {
  it("keeps submitted values except passwords and masks emails for display", () => {
    const formData = new FormData();
    formData.set("email", "a@b.co");
    formData.set("password", "secret");
    expect(keepValues(formData, ["email", "username"])).toEqual({ email: "a@b.co" });
    expect(maskEmail("ahmed.h@gmail.com")).toBe("a******@gmail.com");
    expect(maskEmail("ab@x.dz")).toBe("a***@x.dz");
  });
});

describe("post-action redirects", () => {
  it("only follows same-site paths", () => {
    expect(safeNextPath("/ar/account", "/ar")).toBe("/ar/account");
    expect(safeNextPath("https://evil.example", "/ar")).toBe("/ar");
    expect(safeNextPath("//evil.example", "/ar")).toBe("/ar");
    expect(safeNextPath("/\\evil.example", "/ar")).toBe("/ar");
    expect(safeNextPath("/ar/x\nSet-Cookie: a", "/ar")).toBe("/ar");
    expect(safeNextPath(undefined, "/ar")).toBe("/ar");
  });
});
