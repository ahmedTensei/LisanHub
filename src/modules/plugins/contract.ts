import * as z from "zod/mini";
import { LanguageSkill } from "@/modules/content/levels";
import { EVALUATORS, LocaleText, PluginField, Slug } from "./fields";

/**
 * Plugin Contract v1 (decision R7, ADR 0006 §2): what a *kind* of learning
 * activity declares. Declarative only in phase A — no code, no capabilities.
 * The platform reads this contract as data; it never imports a plugin.
 *
 * zod/mini: this module is bundled into the sandboxed player (ADR 0007).
 */

export const PLUGIN_FORMAT = "lisanhub.plugin/1" as const;

export const PluginId = z
  .string()
  .check(z.minLength(3), z.maxLength(60), z.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, "plugin_id"));

export const Semver = z.string().check(z.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "semver"));

export const Sha256Hex = z.string().check(z.regex(/^[0-9a-f]{64}$/, "sha256"));

/** Which platform evaluator grades an activity, with the evaluator's own options. */
export const Scoring = z.discriminatedUnion("evaluator", [
  z.object({ evaluator: z.literal("multiple_choice") }),
  z.object({
    evaluator: z.literal("fill_blank"),
    ignore_case: z._default(z.boolean(), true),
    ignore_arabic_diacritics: z._default(z.boolean(), false),
  }),
  z.object({ evaluator: z.literal("matching") }),
  z.object({ evaluator: z.literal("word_order") }),
  /** The learner reveals `reveal_fields` and rates their own recall (vocabulary cards, decision R11). */
  z.object({ evaluator: z.literal("self_assessment"), reveal_fields: z.array(Slug).check(z.minLength(1)) }),
  z.object({ evaluator: z.literal("none") }),
]);
export type Scoring = z.infer<typeof Scoring>;

export const PluginActivity = z.object({
  id: Slug,
  name: LocaleText,
  description: z.optional(LocaleText),
  /** Default skill of items of this activity; a package item may override it. */
  skill: z._default(LanguageSkill, "reading"),
  fields: z.array(PluginField).check(z.minLength(1), z.maxLength(30)),
  /** The field the learner answers; null for display-only or self-assessed activities. */
  graded_field: z.nullable(Slug),
  scoring: Scoring,
});
export type PluginActivity = z.infer<typeof PluginActivity>;

/**
 * A starter skeleton for the editor: which activities a new package begins
 * with and a hint per field. It carries no values at all, so it can never hold
 * a sentence that looks like a lesson (decision R8).
 */
export const PluginTemplate = z.object({
  id: Slug,
  name: LocaleText,
  description: z.optional(LocaleText),
  items: z
    .array(
      z.object({
        activity: Slug,
        hints: z._default(z.record(Slug, LocaleText), {}),
      }),
    )
    .check(z.minLength(1), z.maxLength(100)),
});
export type PluginTemplate = z.infer<typeof PluginTemplate>;

export const ASSET_KINDS = ["image"] as const;

/** Attribution kept when a definition is imported from another environment or derived. */
export const PluginProvenance = z.object({
  plugin_id: PluginId,
  version: Semver,
  sha256: Sha256Hex,
  author: z.optional(z.string().check(z.maxLength(200))),
});

export const PluginDefinition = z.object({
  format: z.literal(PLUGIN_FORMAT),
  plugin_id: PluginId,
  version: Semver,
  /** Bumped only for a breaking change of the content shape (ADR 0006 §8, open decision Q18). */
  schema_version: z.int().check(z.gte(1)),
  name: LocaleText,
  description: LocaleText,
  activities: z.array(PluginActivity).check(z.minLength(1), z.maxLength(20)),
  templates: z._default(z.array(PluginTemplate), []),
  /** JSON Schema 2020-12 of `content.json`; generated from the activities by the studio. */
  content_schema: z.record(z.string(), z.unknown()),
  /** Editor field descriptors; generated from the activities by the studio. */
  authoring_fields: z.array(z.record(z.string(), z.unknown())),
  assets_allowed: z._default(z.array(z.enum(ASSET_KINDS)), []),
  /** Must be empty in phase A: a plugin needing any capability is rejected. */
  capabilities_required: z.array(z.string()).check(z.maxLength(0)),
  provenance: z.optional(PluginProvenance),
});
export type PluginDefinition = z.infer<typeof PluginDefinition>;

/** What the studio stores while a contributor is still building: every part optional, nothing enforced yet. */
export const PluginDraft = z.object({
  format: z._default(z.literal(PLUGIN_FORMAT), PLUGIN_FORMAT),
  plugin_id: PluginId,
  version: z._default(Semver, "1.0.0"),
  schema_version: z._default(z.int().check(z.gte(1)), 1),
  name: z._default(z.partial(LocaleText), {}),
  description: z._default(z.partial(LocaleText), {}),
  activities: z._default(z.array(PluginActivity), []),
  templates: z._default(z.array(PluginTemplate), []),
  content_schema: z.optional(z.record(z.string(), z.unknown())),
  authoring_fields: z.optional(z.array(z.record(z.string(), z.unknown()))),
  /** Set when a contributor pasted a schema by hand instead of generating it (advanced escape hatch). */
  custom_schema: z._default(z.boolean(), false),
  assets_allowed: z._default(z.array(z.enum(ASSET_KINDS)), []),
  capabilities_required: z._default(z.array(z.string()), []),
  provenance: z.optional(PluginProvenance),
});
export type PluginDraft = z.infer<typeof PluginDraft>;

export const EvaluatorName = z.enum(EVALUATORS);

/** One item of a package's `content.json`: a stable id, its activity and the field values. */
export const ItemId = z.string().check(z.regex(/^[a-z0-9][a-z0-9-]{3,63}$/, "item_id"));

export const ContentItem = z.object({
  item_id: ItemId,
  activity: Slug,
  skill: z.optional(LanguageSkill),
  fields: z.record(Slug, z.unknown()),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const PackageContent = z.object({ items: z.array(ContentItem) });
export type PackageContent = z.infer<typeof PackageContent>;
