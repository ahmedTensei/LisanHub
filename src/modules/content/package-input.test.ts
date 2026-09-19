import { describe, expect, it } from "vitest";
import {
  CourseInput,
  localizedSummary,
  localizedTitle,
  normalizeTags,
  PackageMetadataInput,
  translationsFromForm,
} from "./package-input";

/** Decision R16: English title required, translations optional; tags normalised. */
describe("package and course metadata input", () => {
  const base = { summary: "", dialect: "", cefr: "", cefrSublevel: "", skills: [], tags: "" };

  it("accepts an English title with common punctuation and refuses other scripts", () => {
    expect(PackageMetadataInput.safeParse({ ...base, title: "Greetings & farewells, part 1 (A1)" }).success).toBe(true);
    expect(PackageMetadataInput.safeParse({ ...base, title: "Café — l'école" }).success).toBe(true);
    const arabic = PackageMetadataInput.safeParse({ ...base, title: "تحيات" });
    expect(arabic.success).toBe(false);
    if (!arabic.success) expect(arabic.error.issues[0].message).toBe("title_latin_required");
    const empty = CourseInput.safeParse({ title: "   ", summary: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.issues[0].message).toBe("required");
  });

  it("keeps only the translations that were filled in, per interface language", () => {
    const form = new Map<string, string>([
      ["title_ar", " تحيات ووداع "],
      ["summary_ar", ""],
      ["title_fr", ""],
      ["summary_fr", "Salutations"],
      ["title_en", ""],
      ["summary_en", ""],
    ]);
    expect(translationsFromForm((name) => form.get(name))).toEqual({
      ar: { title: "تحيات ووداع" },
      fr: { summary: "Salutations" },
    });
    expect(translationsFromForm(() => undefined)).toEqual({});
  });

  it("shows the translated title and summary when present, the English ones otherwise", () => {
    const item = { title: "Greetings", summary: "Hello", translations: { ar: { title: "تحيات" } } };
    expect(localizedTitle(item, "ar")).toBe("تحيات");
    expect(localizedTitle(item, "fr")).toBe("Greetings");
    expect(localizedSummary(item, "ar")).toBe("Hello");
    expect(localizedTitle({ title: "Greetings", translations: null }, "ar")).toBe("Greetings");
  });

  it("normalises tags", () => {
    expect(normalizeTags("Grammaire, Verbes du 1er groupe;  a1 , grammaire")).toEqual([
      "grammaire",
      "verbes-du-1er-groupe",
      "a1",
    ]);
  });
});
