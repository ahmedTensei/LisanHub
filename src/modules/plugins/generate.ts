import { z } from "zod";
import { LANGUAGE_SKILLS } from "@/modules/content/levels";
import { PLUGIN_FORMAT, PluginDefinition, PluginDraft, type PluginActivity, type PluginTemplate } from "./contract";
import {
  EVALUATOR_BY_FIELD_TYPE,
  emptyFieldValue,
  fieldJsonSchema,
  isGradableFieldType,
  type PluginField,
} from "./fields";
import { canonicalJson } from "./hash";
import { isValidJsonSchema } from "./json-schema";

/**
 * Everything derived from the activities a contributor composed in the studio.
 * `content_schema` and `authoring_fields` come out of the same source, so the
 * editor can never drift from what the package validator accepts (ADR 0006 §12).
 */

export const ITEM_ID_PATTERN = "^[a-z0-9][a-z0-9-]{3,63}$";

export function generateContentSchema(activities: readonly PluginActivity[]): Record<string, unknown> {
  const itemSchemas = activities.map((activity) => ({
    type: "object",
    required: ["item_id", "activity", "fields"],
    properties: {
      item_id: { type: "string", pattern: ITEM_ID_PATTERN },
      activity: { const: activity.id },
      skill: { enum: [...LANGUAGE_SKILLS] },
      fields: {
        type: "object",
        required: activity.fields.filter((f) => f.required).map((f) => f.key),
        properties: Object.fromEntries(activity.fields.map((f) => [f.key, fieldJsonSchema(f)])),
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  }));

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: itemSchemas.length === 1 ? itemSchemas[0] : { oneOf: itemSchemas },
      },
    },
    additionalProperties: false,
  };
}

/** The editor reads these to build one form per activity; labels and hints stay translated. */
export interface AuthoringField {
  key: string;
  type: PluginField["type"];
  label: PluginField["label"];
  hint?: PluginField["hint"];
  required: boolean;
  options: Record<string, unknown>;
}

export interface AuthoringActivity {
  activity: string;
  name: PluginActivity["name"];
  skill: PluginActivity["skill"];
  graded_field: string | null;
  evaluator: PluginActivity["scoring"]["evaluator"];
  fields: AuthoringField[];
}

export function generateAuthoringFields(activities: readonly PluginActivity[]): AuthoringActivity[] {
  return activities.map((activity) => ({
    activity: activity.id,
    name: activity.name,
    skill: activity.skill,
    graded_field: activity.graded_field,
    evaluator: activity.scoring.evaluator,
    fields: activity.fields.map((field) => {
      const { key, type, label, hint, required, ...options } = field;
      return { key, type, label, ...(hint ? { hint } : {}), required, options };
    }),
  }));
}

export const DEFINITION_ISSUE_CODES = [
  "invalid",
  "format_invalid",
  "plugin_id_invalid",
  "version_invalid",
  "name_missing",
  "description_missing",
  "activities_empty",
  "activity_id_duplicate",
  "field_key_duplicate",
  "graded_field_missing",
  "graded_field_not_gradable",
  "evaluator_incompatible",
  "reveal_field_missing",
  "template_id_duplicate",
  "template_activity_missing",
  "template_hint_field_missing",
  "templates_too_many",
  "capabilities_not_empty",
  "asset_kind_not_allowed",
  "content_schema_invalid",
  "authoring_fields_mismatch",
  "definition_too_large",
] as const;
export type DefinitionIssueCode = (typeof DEFINITION_ISSUE_CODES)[number];

export interface DefinitionIssue {
  /** Dot path into the definition (`activities.2.fields.0.key`), empty for the whole document. */
  path: string;
  code: DefinitionIssueCode;
}

export interface DefinitionLimits {
  max_templates: number;
  max_definition_bytes: number;
}

export type DefinitionValidation =
  { ok: true; definition: PluginDefinition; sha256?: undefined } | { ok: false; issues: DefinitionIssue[] };

function zodIssueCode(path: string, issue: z.core.$ZodIssue): DefinitionIssueCode {
  if (path === "format") return "format_invalid";
  if (path === "plugin_id") return "plugin_id_invalid";
  if (path === "version") return "version_invalid";
  if (path.startsWith("name")) return "name_missing";
  if (path.startsWith("description") && !path.includes(".")) return "description_missing";
  if (path === "activities" && issue.code === "too_small") return "activities_empty";
  if (path === "capabilities_required") return "capabilities_not_empty";
  if (path.startsWith("assets_allowed")) return "asset_kind_not_allowed";
  return "invalid";
}

/**
 * Fails closed: a definition is accepted only when it matches the contract,
 * every reference inside it resolves, its templates are empty skeletons, and
 * its generated parts match its activities. Issues carry translatable codes
 * and the path of the offending field so the studio can point at it.
 */
export function validateDefinition(input: unknown, limits: DefinitionLimits): DefinitionValidation {
  const issues: DefinitionIssue[] = [];
  const size = new TextEncoder().encode(canonicalJson(input)).length;
  if (size > limits.max_definition_bytes) issues.push({ path: "", code: "definition_too_large" });

  const parsed = PluginDefinition.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String).join(".");
      issues.push({ path, code: zodIssueCode(path, issue) });
    }
    return { ok: false, issues: dedupe(issues) };
  }
  const def = parsed.data;

  // Decision R16: the English name and description are required; the other
  // interface languages are optional translations that fall back to English.
  if (def.name.en.trim() === "") issues.push({ path: "name.en", code: "name_missing" });
  if (def.description.en.trim() === "") issues.push({ path: "description.en", code: "description_missing" });

  const activityIds = new Set<string>();
  def.activities.forEach((activity, i) => {
    const base = `activities.${i}`;
    if (activityIds.has(activity.id)) issues.push({ path: `${base}.id`, code: "activity_id_duplicate" });
    activityIds.add(activity.id);

    const keys = new Set<string>();
    activity.fields.forEach((field, j) => {
      if (keys.has(field.key)) issues.push({ path: `${base}.fields.${j}.key`, code: "field_key_duplicate" });
      keys.add(field.key);
    });

    const graded = activity.graded_field ? activity.fields.find((f) => f.key === activity.graded_field) : null;
    if (activity.graded_field && !graded) {
      issues.push({ path: `${base}.graded_field`, code: "graded_field_missing" });
    } else if (graded && !isGradableFieldType(graded.type)) {
      issues.push({ path: `${base}.graded_field`, code: "graded_field_not_gradable" });
    } else if (graded) {
      if (EVALUATOR_BY_FIELD_TYPE[graded.type] !== activity.scoring.evaluator) {
        issues.push({ path: `${base}.scoring.evaluator`, code: "evaluator_incompatible" });
      }
    } else if (activity.scoring.evaluator !== "self_assessment" && activity.scoring.evaluator !== "none") {
      issues.push({ path: `${base}.scoring.evaluator`, code: "evaluator_incompatible" });
    }
    if (activity.scoring.evaluator === "self_assessment") {
      activity.scoring.reveal_fields.forEach((key, k) => {
        if (!keys.has(key)) issues.push({ path: `${base}.scoring.reveal_fields.${k}`, code: "reveal_field_missing" });
      });
    }
  });

  if (def.templates.length > limits.max_templates) issues.push({ path: "templates", code: "templates_too_many" });
  const templateIds = new Set<string>();
  def.templates.forEach((template, i) => {
    const base = `templates.${i}`;
    if (templateIds.has(template.id)) issues.push({ path: `${base}.id`, code: "template_id_duplicate" });
    templateIds.add(template.id);
    template.items.forEach((item, j) => {
      const activity = def.activities.find((a) => a.id === item.activity);
      if (!activity) {
        issues.push({ path: `${base}.items.${j}.activity`, code: "template_activity_missing" });
        return;
      }
      for (const key of Object.keys(item.hints)) {
        if (!activity.fields.some((f) => f.key === key)) {
          issues.push({ path: `${base}.items.${j}.hints.${key}`, code: "template_hint_field_missing" });
        }
      }
    });
  });

  const usesImages = def.activities.some((a) => a.fields.some((f) => f.type === "image"));
  if (usesImages && !def.assets_allowed.includes("image")) {
    issues.push({ path: "assets_allowed", code: "asset_kind_not_allowed" });
  }

  if (!isValidJsonSchema(def.content_schema)) {
    issues.push({ path: "content_schema", code: "content_schema_invalid" });
  }
  const authoring = generateAuthoringFields(def.activities);
  if (canonicalJson(def.authoring_fields) !== canonicalJson(authoring)) {
    issues.push({ path: "authoring_fields", code: "authoring_fields_mismatch" });
  }

  return issues.length > 0 ? { ok: false, issues: dedupe(issues) } : { ok: true, definition: def };
}

/**
 * Turns a studio draft into a full definition candidate: regenerates the
 * schema and the authoring fields from the activities (unless the contributor
 * pasted a custom schema), then validates. The draft itself is never mutated.
 */
export function definitionFromDraft(draftInput: unknown, limits: DefinitionLimits): DefinitionValidation {
  const draft = PluginDraft.safeParse(draftInput);
  if (!draft.success) {
    return {
      ok: false,
      issues: draft.error.issues.map((i) => {
        const path = i.path.map(String).join(".");
        return { path, code: zodIssueCode(path, i) };
      }),
    };
  }
  const d = draft.data;
  const candidate = {
    format: PLUGIN_FORMAT,
    plugin_id: d.plugin_id,
    version: d.version,
    schema_version: d.schema_version,
    // Decision R16: English is required, the other interface languages are optional
    // translations, so a draft that has not written them yet still reaches the
    // contract with empty strings (and fails only on the missing English text).
    name: { ar: d.name.ar ?? "", fr: d.name.fr ?? "", en: d.name.en ?? "" },
    description: { ar: d.description.ar ?? "", fr: d.description.fr ?? "", en: d.description.en ?? "" },
    activities: d.activities,
    templates: d.templates,
    content_schema: d.custom_schema && d.content_schema ? d.content_schema : generateContentSchema(d.activities),
    authoring_fields: generateAuthoringFields(d.activities),
    assets_allowed: d.assets_allowed,
    capabilities_required: d.capabilities_required,
    ...(d.provenance ? { provenance: d.provenance } : {}),
  };
  return validateDefinition(candidate, limits);
}

/** True when a definition's schema is exactly what its activities generate (no custom schema). */
export function hasGeneratedSchema(def: PluginDefinition): boolean {
  return canonicalJson(def.content_schema) === canonicalJson(generateContentSchema(def.activities));
}

/** Empty skeleton of an item for a template entry: every field at its empty value. */
export function templateItemSkeleton(activity: PluginActivity): Record<string, unknown> {
  return Object.fromEntries(activity.fields.map((f) => [f.key, emptyFieldValue(f)]));
}

export function findTemplate(def: PluginDefinition, id: string): PluginTemplate | undefined {
  return def.templates.find((t) => t.id === id);
}

function dedupe(issues: DefinitionIssue[]): DefinitionIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.path}|${i.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
