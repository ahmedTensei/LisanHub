import { z } from "zod";

export const LANGUAGE_CODE_PATTERN = /^[a-z]{3}$/;
export const DIALECT_TAG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const DIALECT_TAG_MAX_LENGTH = 40;

/** ISO 639-3 code, e.g. "arb" (Standard Arabic), "arq" (Algerian Arabic), "fra", "kab". */
export const LanguageCode = z.string().regex(LANGUAGE_CODE_PATTERN, "ISO 639-3 code expected");
export type LanguageCode = z.infer<typeof LanguageCode>;

/** A dialect is metadata on a language, never a separate language. */
export const DialectTag = z
  .string()
  .regex(DIALECT_TAG_PATTERN, "lowercase kebab-case tag expected")
  .max(DIALECT_TAG_MAX_LENGTH);
export type DialectTag = z.infer<typeof DialectTag>;

/** Every educational resource is defined by a pair: comfortable/native language -> target language. */
export const LanguagePair = z.object({
  native: LanguageCode,
  target: LanguageCode,
  dialect: DialectTag.optional(),
});
export type LanguagePair = z.infer<typeof LanguagePair>;

export function pairKey(pair: LanguagePair): string {
  return `${pair.native}>${pair.target}`;
}

export interface DialectRanked {
  targetLang: LanguageCode;
  dialectTag?: string | null;
}

/**
 * Orders results so the learner's preferred dialect comes first.
 * Never removes other dialects: a preference is a priority, not a filter.
 */
export function rankByDialectPreference<T extends DialectRanked>(items: readonly T[], preferred?: DialectTag): T[] {
  if (!preferred) return [...items];
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aMatch = a.item.dialectTag === preferred ? 0 : 1;
      const bMatch = b.item.dialectTag === preferred ? 0 : 1;
      return aMatch - bMatch || a.index - b.index;
    })
    .map(({ item }) => item);
}
