import * as z from "zod/mini";
import { UI_LOCALES, type UiLocale } from "@/modules/account/ui-locales";

/**
 * The field-type catalogue of the Plugin Studio (decision R7, ADR 0006 §12).
 *
 * A plugin describes the structure of one content item by picking fields from
 * this catalogue. Everything downstream is generated from that choice: the
 * JSON Schema of `content.json`, the editor's authoring fields, the empty
 * skeleton of a template, and the reference evaluator an activity may use.
 * Adding a field type here is the only way a new shape of content appears —
 * never a branch in rendering, authoring or scoring code.
 *
 * zod/mini: this module is bundled into the sandboxed player (ADR 0007).
 */

export const Slug = z
  .string()
  .check(z.minLength(1), z.maxLength(60), z.regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/, "slug"));

/** Text in every interface language; the studio requires all three before publishing. */
export const LocaleText = z.object(
  Object.fromEntries(UI_LOCALES.map((l) => [l, z.string().check(z.maxLength(500))])) as Record<
    UiLocale,
    ReturnType<typeof z.string>
  >,
);
export type LocaleText = z.infer<typeof LocaleText>;

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "item_list",
  "single_choice",
  "multiple_choice",
  "matching_pairs",
  "ordering",
  "blank_in_text",
  "image",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const bounded = (min: number, max: number, fallback: number) =>
  z._default(z.int().check(z.gte(min), z.lte(max)), fallback);

const FieldBase = z.object({
  key: Slug,
  label: LocaleText,
  hint: z.optional(LocaleText),
  required: z._default(z.boolean(), true),
});

/** Per-type structural options; content values never live here. */
export const PluginField = z.discriminatedUnion("type", [
  z.extend(FieldBase, { type: z.literal("short_text"), max_length: bounded(1, 500, 200) }),
  z.extend(FieldBase, { type: z.literal("long_text"), max_length: bounded(1, 20_000, 5000) }),
  z.extend(FieldBase, { type: z.literal("item_list"), min_items: bounded(0, 100, 1), max_items: bounded(1, 200, 50) }),
  z.extend(FieldBase, {
    type: z.literal("single_choice"),
    min_options: bounded(2, 10, 2),
    max_options: bounded(2, 20, 6),
  }),
  z.extend(FieldBase, {
    type: z.literal("multiple_choice"),
    min_options: bounded(2, 10, 2),
    max_options: bounded(2, 20, 8),
  }),
  z.extend(FieldBase, {
    type: z.literal("matching_pairs"),
    min_pairs: bounded(2, 10, 2),
    max_pairs: bounded(2, 30, 10),
  }),
  z.extend(FieldBase, { type: z.literal("ordering"), min_tokens: bounded(2, 10, 2), max_tokens: bounded(2, 40, 20) }),
  z.extend(FieldBase, { type: z.literal("blank_in_text"), max_blanks: bounded(1, 20, 5) }),
  z.extend(FieldBase, { type: z.literal("image") }),
]);
export type PluginField = z.infer<typeof PluginField>;

/** Values a package may hold for each field type (validated in the editor with Zod, in packages with JSON Schema). */
const OptionId = z.string().check(z.minLength(1), z.maxLength(64));
export const ASSET_REFERENCE_PATTERN = /^assets\/[a-z0-9][a-z0-9._-]*$/;
export const FIELD_VALUE_SCHEMAS = {
  short_text: z.string(),
  long_text: z.string(),
  item_list: z.array(z.string()),
  single_choice: z.object({ options: z.array(z.object({ id: OptionId, text: z.string() })), correct: OptionId }),
  multiple_choice: z.object({
    options: z.array(z.object({ id: OptionId, text: z.string() })),
    correct: z.array(OptionId),
  }),
  matching_pairs: z.object({ pairs: z.array(z.object({ id: OptionId, left: z.string(), right: z.string() })) }),
  ordering: z.object({ tokens: z.array(z.string()) }),
  blank_in_text: z.object({ template: z.string(), blanks: z.array(z.array(z.string())) }),
  image: z.object({ asset: z.string().check(z.regex(ASSET_REFERENCE_PATTERN)), alt: z.string() }),
} as const satisfies Record<FieldType, z.ZodMiniType>;

export type FieldValue<T extends FieldType = FieldType> = z.infer<(typeof FIELD_VALUE_SCHEMAS)[T]>;

const text = (max: number) => z.string().check(z.trim(), z.minLength(1, "required"), z.maxLength(max, "too_long"));
const option = () => z.object({ id: OptionId, text: text(500) });
const uniqueOptions = z.refine(
  (v) => {
    const options = (v as { options: { id: string }[] }).options;
    return new Set(options.map((o) => o.id)).size === options.length;
  },
  { message: "duplicate_option", path: ["options"] },
);

/**
 * The strict value schema of one configured field, as the editor enforces it
 * before anything is written: lengths, counts, non-empty texts, a correct
 * option that exists, blanks matching the template.
 */
export function fieldValueSchema(field: PluginField): z.ZodMiniType {
  switch (field.type) {
    case "short_text":
      return text(field.max_length);
    case "long_text":
      return text(field.max_length);
    case "item_list":
      return z
        .array(text(500))
        .check(z.minLength(field.min_items, "too_few"), z.maxLength(field.max_items, "too_many"));
    case "single_choice":
      return z
        .object({
          options: z
            .array(option())
            .check(z.minLength(field.min_options, "too_few"), z.maxLength(field.max_options, "too_many")),
          correct: OptionId,
        })
        .check(
          z.refine((v) => v.options.some((o) => o.id === v.correct), { message: "correct_missing", path: ["correct"] }),
          uniqueOptions,
        );
    case "multiple_choice":
      return z
        .object({
          options: z
            .array(option())
            .check(z.minLength(field.min_options, "too_few"), z.maxLength(field.max_options, "too_many")),
          correct: z.array(OptionId).check(z.minLength(1, "correct_missing")),
        })
        .check(
          z.refine((v) => v.correct.every((c) => v.options.some((o) => o.id === c)), {
            message: "correct_missing",
            path: ["correct"],
          }),
          uniqueOptions,
        );
    case "matching_pairs":
      return z.object({
        pairs: z
          .array(z.object({ id: OptionId, left: text(500), right: text(500) }))
          .check(z.minLength(field.min_pairs, "too_few"), z.maxLength(field.max_pairs, "too_many")),
      });
    case "ordering":
      return z.object({
        tokens: z
          .array(text(200))
          .check(z.minLength(field.min_tokens, "too_few"), z.maxLength(field.max_tokens, "too_many")),
      });
    case "blank_in_text":
      return z
        .object({
          template: text(5000),
          blanks: z
            .array(z.array(text(200)).check(z.minLength(1, "required")))
            .check(z.minLength(1, "too_few"), z.maxLength(field.max_blanks, "too_many")),
        })
        .check(
          z.refine((v) => countBlanks(v.template) === v.blanks.length, { message: "blank_count", path: ["blanks"] }),
        );
    case "image":
      return z.object({
        asset: z.string().check(z.regex(ASSET_REFERENCE_PATTERN, "required")),
        alt: text(300),
      });
  }
}

/** Number of `{{n}}` gaps in a blank-in-text template. */
export function countBlanks(template: string): number {
  return (template.match(/\{\{\d+\}\}/g) ?? []).length;
}

/** The JSON Schema (2020-12) fragment of one field's value; generated, never hand-written. */
export function fieldJsonSchema(field: PluginField): Record<string, unknown> {
  const str = (max: number) => ({ type: "string", minLength: 1, maxLength: max });
  const optionSchema = {
    type: "object",
    required: ["id", "text"],
    properties: { id: str(64), text: str(500) },
    additionalProperties: false,
  };
  switch (field.type) {
    case "short_text":
      return str(field.max_length);
    case "long_text":
      return str(field.max_length);
    case "item_list":
      return { type: "array", items: str(500), minItems: field.min_items, maxItems: field.max_items };
    case "single_choice":
      return {
        type: "object",
        required: ["options", "correct"],
        properties: {
          options: { type: "array", items: optionSchema, minItems: field.min_options, maxItems: field.max_options },
          correct: str(64),
        },
        additionalProperties: false,
      };
    case "multiple_choice":
      return {
        type: "object",
        required: ["options", "correct"],
        properties: {
          options: { type: "array", items: optionSchema, minItems: field.min_options, maxItems: field.max_options },
          correct: { type: "array", items: str(64), minItems: 1 },
        },
        additionalProperties: false,
      };
    case "matching_pairs":
      return {
        type: "object",
        required: ["pairs"],
        properties: {
          pairs: {
            type: "array",
            minItems: field.min_pairs,
            maxItems: field.max_pairs,
            items: {
              type: "object",
              required: ["id", "left", "right"],
              properties: { id: str(64), left: str(500), right: str(500) },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      };
    case "ordering":
      return {
        type: "object",
        required: ["tokens"],
        properties: {
          tokens: { type: "array", items: str(200), minItems: field.min_tokens, maxItems: field.max_tokens },
        },
        additionalProperties: false,
      };
    case "blank_in_text":
      return {
        type: "object",
        required: ["template", "blanks"],
        properties: {
          template: str(5000),
          blanks: {
            type: "array",
            minItems: 1,
            maxItems: field.max_blanks,
            items: { type: "array", minItems: 1, items: str(200) },
          },
        },
        additionalProperties: false,
      };
    case "image":
      return {
        type: "object",
        required: ["asset", "alt"],
        properties: { asset: { type: "string", pattern: ASSET_REFERENCE_PATTERN.source }, alt: str(300) },
        additionalProperties: false,
      };
  }
}

/** The empty value the editor starts from; templates never carry anything else (decision R8). */
export function emptyFieldValue(field: PluginField): FieldValue {
  switch (field.type) {
    case "short_text":
    case "long_text":
      return "";
    case "item_list":
      return [];
    case "single_choice":
      return { options: [], correct: "" };
    case "multiple_choice":
      return { options: [], correct: [] };
    case "matching_pairs":
      return { pairs: [] };
    case "ordering":
      return { tokens: [] };
    case "blank_in_text":
      return { template: "", blanks: [] };
    case "image":
      return { asset: "", alt: "" };
  }
}

/** True when a value holds no text at all — how a template item is verified to be empty. */
export function isEmptyFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every(isEmptyFieldValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isEmptyFieldValue);
  return typeof value !== "number";
}

/** Reference evaluators of the platform (`src/modules/exercises`) a field type can be graded with. */
export const EVALUATORS = [
  "multiple_choice",
  "fill_blank",
  "matching",
  "word_order",
  "self_assessment",
  "none",
] as const;
export type Evaluator = (typeof EVALUATORS)[number];

export const EVALUATOR_BY_FIELD_TYPE: Readonly<Partial<Record<FieldType, Evaluator>>> = {
  single_choice: "multiple_choice",
  multiple_choice: "multiple_choice",
  blank_in_text: "fill_blank",
  matching_pairs: "matching",
  ordering: "word_order",
};

/** Field types the learner interacts with; the rest are display-only (prompt, explanation, picture). */
export function isGradableFieldType(type: FieldType): boolean {
  return type in EVALUATOR_BY_FIELD_TYPE;
}

/** Field types that may hold a package asset (only images in phase A). */
export function fieldAssetKind(type: FieldType): "image" | null {
  return type === "image" ? "image" : null;
}
