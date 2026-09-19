import { describe, expect, it } from "vitest";
import { PluginDefinition, type PluginActivity, type PluginDraft } from "./contract";
import { evaluateItem, toExercise } from "./evaluate";
import { emptyFieldValue, fieldValueSchema, isEmptyFieldValue } from "./fields";
import { definitionFromDraft, generateAuthoringFields, generateContentSchema, validateDefinition } from "./generate";
import { canonicalJson, sha256OfJson } from "./hash";
import { compileJsonSchema } from "./json-schema";
import { definitionSha256, exportDefinition, importDefinition } from "./portable";

const t = (text: string) => ({ ar: text, fr: text, en: text });
const limits = { max_templates: 5, max_definition_bytes: 256_000 };

const activities: PluginActivity[] = [
  {
    id: "choose",
    name: t("choose"),
    skill: "reading",
    fields: [
      { key: "prompt", type: "short_text", label: t("prompt"), required: true, max_length: 200 },
      { key: "picture", type: "image", label: t("picture"), required: false },
      { key: "answer", type: "single_choice", label: t("answer"), required: true, min_options: 2, max_options: 6 },
    ],
    graded_field: "answer",
    scoring: { evaluator: "multiple_choice" },
  },
  {
    id: "fill",
    name: t("fill"),
    skill: "writing",
    fields: [{ key: "gap", type: "blank_in_text", label: t("gap"), required: true, max_blanks: 5 }],
    graded_field: "gap",
    scoring: { evaluator: "fill_blank", ignore_case: true, ignore_arabic_diacritics: true },
  },
  {
    id: "card",
    name: t("card"),
    skill: "reading",
    fields: [
      { key: "front", type: "short_text", label: t("front"), required: true, max_length: 200 },
      { key: "back", type: "short_text", label: t("back"), required: true, max_length: 200 },
    ],
    graded_field: null,
    scoring: { evaluator: "self_assessment", reveal_fields: ["back"] },
  },
];

/** A complete draft as the studio would store it; every test starts from a copy. */
function draft(overrides: Partial<PluginDraft> = {}): PluginDraft {
  return {
    format: "lisanhub.plugin/1",
    plugin_id: "test-dialogue",
    version: "1.0.0",
    schema_version: 1,
    name: t("Dialogue"),
    description: t("Test plugin"),
    activities,
    templates: [{ id: "starter", name: t("starter"), items: [{ activity: "choose", hints: { prompt: t("hint") } }] }],
    custom_schema: false,
    assets_allowed: ["image"],
    capabilities_required: [],
    ...overrides,
  };
}

function definition(overrides: Partial<PluginDraft> = {}): PluginDefinition {
  const result = definitionFromDraft(draft(overrides), limits);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.definition;
}

const item = {
  item_id: "item-0001",
  activity: "choose",
  fields: {
    prompt: "Bonjour means…",
    answer: {
      options: [
        { id: "a", text: "صباح الخير" },
        { id: "b", text: "شكرًا" },
      ],
      correct: "a",
    },
  },
};

describe("plugin contract", () => {
  it("accepts a well-formed definition generated from a draft", () => {
    const def = definition();
    expect(def.content_schema).toMatchObject({ $schema: "https://json-schema.org/draft/2020-12/schema" });
    expect(def.authoring_fields).toEqual(generateAuthoringFields(def.activities));
    expect(def.capabilities_required).toEqual([]);
  });

  it("rejects a plugin that requires any capability", () => {
    const result = definitionFromDraft(draft({ capabilities_required: ["network"] }), limits);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContainEqual({ path: "capabilities_required", code: "capabilities_not_empty" });
  });

  it("rejects a plugin id outside the slug pattern", () => {
    for (const bad of ["Bad", "a", "has space", "-lead", "trail-", "with_underscore"]) {
      const result = definitionFromDraft(draft({ plugin_id: bad }), limits);
      expect(result.ok, bad).toBe(false);
      if (!result.ok) expect(result.issues.map((i) => i.code)).toContain("plugin_id_invalid");
    }
  });

  it("rejects an asset kind the phase does not allow and image fields without the image asset kind", () => {
    const withAudio = validateDefinition({ ...definition(), assets_allowed: ["audio"] }, limits);
    expect(withAudio.ok).toBe(false);
    if (!withAudio.ok) expect(withAudio.issues[0].code).toBe("asset_kind_not_allowed");

    const noImage = definitionFromDraft(draft({ assets_allowed: [] }), limits);
    expect(noImage.ok).toBe(false);
    if (!noImage.ok) expect(noImage.issues).toContainEqual({ path: "assets_allowed", code: "asset_kind_not_allowed" });
  });

  it("points at the field when ids are duplicated or references dangle", () => {
    const dupActivity = definitionFromDraft(draft({ activities: [activities[0], activities[0]] }), limits);
    expect(dupActivity.ok).toBe(false);
    if (!dupActivity.ok)
      expect(dupActivity.issues).toContainEqual({ path: "activities.1.id", code: "activity_id_duplicate" });

    const dangling = definitionFromDraft(draft({ activities: [{ ...activities[0], graded_field: "nope" }] }), limits);
    expect(dangling.ok).toBe(false);
    if (!dangling.ok)
      expect(dangling.issues).toContainEqual({ path: "activities.0.graded_field", code: "graded_field_missing" });

    const badTemplate = definitionFromDraft(
      draft({ templates: [{ id: "x", name: t("x"), items: [{ activity: "missing", hints: {} }] }] }),
      limits,
    );
    expect(badTemplate.ok).toBe(false);
    if (!badTemplate.ok) {
      expect(badTemplate.issues).toContainEqual({
        path: "templates.0.items.0.activity",
        code: "template_activity_missing",
      });
    }
  });

  it("rejects an evaluator that does not fit the graded field, and self-assessment without reveal fields", () => {
    const wrong = definitionFromDraft(
      draft({ activities: [{ ...activities[0], scoring: { evaluator: "matching" } }] }),
      limits,
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok)
      expect(wrong.issues).toContainEqual({ path: "activities.0.scoring.evaluator", code: "evaluator_incompatible" });

    const reveal = definitionFromDraft(
      draft({
        activities: [{ ...activities[2], scoring: { evaluator: "self_assessment", reveal_fields: ["ghost"] } }],
      }),
      limits,
    );
    expect(reveal.ok).toBe(false);
    if (!reveal.ok) expect(reveal.issues[0].code).toBe("reveal_field_missing");
  });

  it("requires the English name and description only (decision R16) and enforces the template and size limits", () => {
    const optionalTranslations = definitionFromDraft(draft({ name: { ar: "", fr: "", en: "Dialogue" } }), limits);
    expect(optionalTranslations.ok).toBe(true);
    const missing = definitionFromDraft(draft({ name: { ar: "حوار", fr: "Dialogue", en: "" } }), limits);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues).toContainEqual({ path: "name.en", code: "name_missing" });

    const many = definitionFromDraft(draft(), { max_templates: 0, max_definition_bytes: 256_000 });
    expect(many.ok).toBe(false);
    if (!many.ok) expect(many.issues).toContainEqual({ path: "templates", code: "templates_too_many" });

    const large = definitionFromDraft(draft(), { max_templates: 5, max_definition_bytes: 100 });
    expect(large.ok).toBe(false);
    if (!large.ok) expect(large.issues).toContainEqual({ path: "", code: "definition_too_large" });
  });

  it("rejects a pasted content schema that is not valid JSON Schema", () => {
    const result = definitionFromDraft(draft({ custom_schema: true, content_schema: { type: "nonsense" } }), limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual({ path: "content_schema", code: "content_schema_invalid" });
  });

  it("templates carry hints only — never a content value (decision R8)", () => {
    const def = definition();
    for (const template of def.templates) {
      for (const entry of template.items) expect(Object.keys(entry)).toEqual(["activity", "hints"]);
    }
    for (const activity of def.activities) {
      for (const field of activity.fields) expect(isEmptyFieldValue(emptyFieldValue(field))).toBe(true);
    }
    expect(isEmptyFieldValue({ options: [{ id: "a", text: "Bonjour" }], correct: "a" })).toBe(false);
  });
});

describe("generated content schema", () => {
  it("validates a well-formed item and rejects a malformed one", () => {
    const validate = compileJsonSchema(generateContentSchema(activities));
    expect(validate({ items: [item] })).toEqual([]);
    expect(validate({ items: [{ ...item, fields: { ...item.fields, extra: 1 } }] }).length).toBeGreaterThan(0);
    expect(validate({ items: [{ ...item, item_id: "x" }] }).length).toBeGreaterThan(0);
    expect(validate({ items: [{ ...item, activity: "unknown" }] }).length).toBeGreaterThan(0);
    expect(validate({ items: [{ item_id: "item-0002", activity: "fill", fields: {} }] }).length).toBeGreaterThan(0);
  });

  it("gives the editor strict per-field validation with translatable codes", () => {
    const answer = fieldValueSchema(activities[0].fields[2]);
    expect(answer.safeParse(item.fields.answer).success).toBe(true);
    const wrong = answer.safeParse({ options: [{ id: "a", text: "x" }], correct: "zzz" });
    expect(wrong.success).toBe(false);

    const gap = fieldValueSchema(activities[1].fields[0]);
    expect(gap.safeParse({ template: "Je {{0}} étudiant", blanks: [["suis"]] }).success).toBe(true);
    expect(gap.safeParse({ template: "Je {{0}} {{1}}", blanks: [["suis"]] }).success).toBe(false);
  });
});

describe("hashing and portability", () => {
  it("hashes canonically regardless of key order", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: null }] })).toBe('{"a":[{"c":null,"d":2}],"b":1}');
    expect(sha256OfJson({ b: 1, a: 2 })).toBe(sha256OfJson({ a: 2, b: 1 }));
  });

  it("exports then imports the same definition with the same sha256", () => {
    const def = definition();
    const file = exportDefinition(def);
    const imported = importDefinition(file, limits);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.sha256).toBe(definitionSha256(def));
      expect(canonicalJson(imported.definition)).toBe(canonicalJson(def));
      expect(exportDefinition(imported.definition)).toBe(file);
    }
  });

  it("refuses a tampered or unsigned file", () => {
    const def = definition();
    const tampered = exportDefinition(def).replace('"Test plugin"', '"Edited"');
    expect(importDefinition(tampered, limits)).toMatchObject({ ok: false, reason: "sha256_mismatch" });
    expect(importDefinition("{}", limits)).toMatchObject({ ok: false, reason: "sha256_missing" });
    expect(importDefinition("nope", limits)).toMatchObject({ ok: false, reason: "not_json" });
  });
});

describe("evaluation through the reference evaluators", () => {
  it("maps a choice item to the multiple-choice evaluator", () => {
    const def = definition();
    const result = evaluateItem(def.activities[0], item, { type: "multiple_choice", selectedOptionIds: ["a"] });
    expect(result).toMatchObject({ correct: true, score: 1 });
  });

  it("maps a blank item with the activity's diacritics option", () => {
    const def = definition();
    const gapItem = {
      item_id: "item-0002",
      activity: "fill",
      fields: { gap: { template: "أنا {{0}}", blanks: [["طالب"]] } },
    };
    expect(toExercise(def.activities[1], gapItem)).toMatchObject({
      type: "fill_blank",
      matching: { ignoreArabicDiacritics: true },
    });
    expect(evaluateItem(def.activities[1], gapItem, { type: "fill_blank", values: ["طَالِب"] })?.correct).toBe(true);
  });

  it("maps a card to self-assessment with the revealed side as the back", () => {
    const def = definition();
    const card = { item_id: "item-0003", activity: "card", fields: { front: "كتاب", back: "livre" } };
    expect(toExercise(def.activities[2], card)).toMatchObject({
      type: "self_assessment",
      front: "كتاب",
      back: "livre",
    });
    expect(evaluateItem(def.activities[2], card, { type: "self_assessment", rating: "again" })?.score).toBe(0);
  });
});
