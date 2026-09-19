import { z } from "zod";
import { normalizeDialectTag } from "@/modules/account/schemas";
import { CEFR_LEVELS, LANGUAGE_SKILLS } from "./levels";

/**
 * Input rules of the content editor's metadata form. Messages are codes from
 * FORM_ERROR_CODES (`forms.errors.*`). Tags are normalised the way dialect
 * tags are: lowercase, letters and digits, hyphens between words.
 */

export const TITLE_MAX_LENGTH = 200;
export const SUMMARY_MAX_LENGTH = 2000;
export const TAG_MAX_LENGTH = 40;
export const TAGS_MAX = 20;

const TAG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

/** "Grammaire, Verbes du 1er groupe;  a1 " -> ["grammaire", "verbes-du-1er-groupe", "a1"] (deduplicated). */
export function normalizeTags(input: unknown): string[] {
  if (typeof input !== "string") return [];
  const tags = input
    .split(/[,;\n،]/)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter((t) => t !== "");
  return [...new Set(tags)];
}

const Tag = z.string().max(TAG_MAX_LENGTH, { error: "tag_invalid" }).regex(TAG_PATTERN, { error: "tag_invalid" });

const optionalText = (max: number, code: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(max, { error: code }));

/**
 * Decision R16: the title of a package or course is written in English (Latin
 * letters, digits, spaces and common punctuation — the same rule as the
 * database constraint `content_items_title_latin`); translating the title and
 * the summary into the interface languages is optional.
 */
export const LATIN_TITLE_PATTERN = /^[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ '’.,:;!?()&/+"–—-]*$/;

export const Title = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : ""),
  z
    .string()
    .min(1, { error: "required" })
    .max(TITLE_MAX_LENGTH, { error: "title_too_long" })
    .regex(LATIN_TITLE_PATTERN, { error: "title_latin_required" }),
);

const TranslationEntry = z.object({
  title: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(TITLE_MAX_LENGTH, { error: "title_too_long" }),
  ),
  summary: optionalText(SUMMARY_MAX_LENGTH, "summary_too_long"),
});

export const TRANSLATION_LOCALES = ["ar", "fr", "en"] as const;
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];
export type ContentTranslations = Partial<Record<TranslationLocale, { title?: string; summary?: string }>>;

/** Reads `title_ar`, `summary_fr`… from a form into the stored shape, dropping empty entries. */
export function translationsFromForm(get: (name: string) => unknown): ContentTranslations {
  const out: ContentTranslations = {};
  for (const locale of TRANSLATION_LOCALES) {
    const entry = TranslationEntry.parse({ title: get(`title_${locale}`), summary: get(`summary_${locale}`) });
    const kept: { title?: string; summary?: string } = {};
    if (entry.title) kept.title = entry.title;
    if (entry.summary) kept.summary = entry.summary;
    if (Object.keys(kept).length > 0) out[locale] = kept;
  }
  return out;
}

/** The title to show in one interface language: its translation when present, else the English title. */
export function localizedTitle(
  item: { title: string; translations?: ContentTranslations | null },
  locale: string,
): string {
  const entry = item.translations?.[locale as TranslationLocale];
  return entry?.title || item.title;
}

export function localizedSummary(
  item: { summary: string | null; translations?: ContentTranslations | null },
  locale: string,
): string | null {
  const entry = item.translations?.[locale as TranslationLocale];
  return entry?.summary || item.summary;
}

export const PackageMetadataInput = z.object({
  title: Title,
  summary: optionalText(SUMMARY_MAX_LENGTH, "summary_too_long"),
  dialect: z.preprocess(normalizeDialectTag, z.string().max(40, { error: "dialect_invalid" }).optional()),
  cefr: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.enum(CEFR_LEVELS, { error: "cefr_invalid" }).nullable(),
  ),
  cefrSublevel: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(1).max(9).nullable(),
  ),
  skills: z.preprocess(
    (v) => (Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : []),
    z.array(z.enum(LANGUAGE_SKILLS, { error: "skill_invalid" })).max(4),
  ),
  tags: z.preprocess(normalizeTags, z.array(Tag).max(TAGS_MAX, { error: "too_many" })),
});
export type PackageMetadataInput = z.infer<typeof PackageMetadataInput>;

export const CourseInput = z.object({
  title: PackageMetadataInput.shape.title,
  summary: PackageMetadataInput.shape.summary,
});
