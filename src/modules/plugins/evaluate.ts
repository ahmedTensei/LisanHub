import { ExerciseAnswer, ExerciseDefinition } from "@/modules/exercises/definitions";
import { evaluate, type Evaluation } from "@/modules/exercises/evaluate";
import type { ContentItem, PluginActivity } from "./contract";
import { FIELD_VALUE_SCHEMAS, type PluginField } from "./fields";

/**
 * Bridges a package item to the platform's reference evaluators. A plugin
 * never carries evaluation logic: its activity names an evaluator and the
 * field it grades, and this module builds the exercise the evaluator
 * understands. Used by the server for the authoritative score and bundled into
 * the sandboxed player for instant feedback — one source, two call sites.
 */

function textOf(field: PluginField, value: unknown): string {
  switch (field.type) {
    case "short_text":
    case "long_text":
      return typeof value === "string" ? value : "";
    case "item_list":
      return Array.isArray(value) ? value.filter((v) => typeof v === "string").join("\n") : "";
    case "image": {
      const parsed = FIELD_VALUE_SCHEMAS.image.safeParse(value);
      return parsed.success ? parsed.data.alt : "";
    }
    default:
      return "";
  }
}

function joinedText(activity: PluginActivity, item: ContentItem, keys: readonly string[]): string {
  return keys
    .map((key) => {
      const field = activity.fields.find((f) => f.key === key);
      return field ? textOf(field, item.fields[key]) : "";
    })
    .filter((t) => t.trim() !== "")
    .join("\n");
}

/** The first text a learner reads in the item, used as the exercise prompt. */
function promptOf(activity: PluginActivity, item: ContentItem): string {
  const textKeys = activity.fields.filter((f) => f.type === "short_text" || f.type === "long_text").map((f) => f.key);
  return joinedText(activity, item, textKeys) || activity.id;
}

/**
 * The reference exercise an item resolves to, or null when the activity is
 * display-only (`none`). Throws when the item does not fit its activity — a
 * package that passed validation never does.
 */
export function toExercise(activity: PluginActivity, item: ContentItem): ExerciseDefinition | null {
  const skill = item.skill ?? activity.skill;
  const id = item.item_id;
  const scoring = activity.scoring;

  if (scoring.evaluator === "none") return null;

  if (scoring.evaluator === "self_assessment") {
    const revealed = new Set(scoring.reveal_fields);
    const frontKeys = activity.fields.filter((f) => !revealed.has(f.key)).map((f) => f.key);
    return ExerciseDefinition.parse({
      type: "self_assessment",
      id,
      skill,
      front: joinedText(activity, item, frontKeys) || activity.id,
      back: joinedText(activity, item, scoring.reveal_fields) || activity.id,
    });
  }

  const graded = activity.fields.find((f) => f.key === activity.graded_field);
  if (!graded) throw new Error(`activity ${activity.id} has no graded field`);
  const value = item.fields[graded.key];
  const prompt = promptOf(activity, item);

  switch (scoring.evaluator) {
    case "multiple_choice": {
      if (graded.type === "single_choice") {
        const v = FIELD_VALUE_SCHEMAS.single_choice.parse(value);
        return ExerciseDefinition.parse({
          type: "multiple_choice",
          id,
          skill,
          prompt,
          options: v.options,
          correctOptionIds: [v.correct],
        });
      }
      const v = FIELD_VALUE_SCHEMAS.multiple_choice.parse(value);
      return ExerciseDefinition.parse({
        type: "multiple_choice",
        id,
        skill,
        prompt,
        options: v.options,
        correctOptionIds: v.correct,
      });
    }
    case "fill_blank": {
      const v = FIELD_VALUE_SCHEMAS.blank_in_text.parse(value);
      return ExerciseDefinition.parse({
        type: "fill_blank",
        id,
        skill,
        template: v.template,
        blanks: v.blanks,
        matching: { ignoreCase: scoring.ignore_case, ignoreArabicDiacritics: scoring.ignore_arabic_diacritics },
      });
    }
    case "matching": {
      const v = FIELD_VALUE_SCHEMAS.matching_pairs.parse(value);
      return ExerciseDefinition.parse({ type: "matching", id, skill, prompt, pairs: v.pairs });
    }
    case "word_order": {
      const v = FIELD_VALUE_SCHEMAS.ordering.parse(value);
      return ExerciseDefinition.parse({ type: "word_order", id, skill, prompt, tokens: v.tokens });
    }
  }
}

/** Authoritative evaluation of a learner's answer to one item; null for display-only activities. */
export function evaluateItem(activity: PluginActivity, item: ContentItem, answer: unknown): Evaluation | null {
  const exercise = toExercise(activity, item);
  if (!exercise) return null;
  return evaluate(exercise, ExerciseAnswer.parse(answer));
}
