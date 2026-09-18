import { z } from "zod";
import { LanguageSkill } from "@/modules/content/levels";

const Id = z.string().min(1).max(64);

const TextMatching = z
  .object({
    /** Ignore letter case (Latin, Cyrillic, ...). */
    ignoreCase: z.boolean().default(true),
    /** Ignore Arabic short vowels (harakat) and tatweel when comparing answers. */
    ignoreArabicDiacritics: z.boolean().default(false),
  })
  .default({ ignoreCase: true, ignoreArabicDiacritics: false });

export const MultipleChoice = z
  .object({
    type: z.literal("multiple_choice"),
    id: Id,
    skill: LanguageSkill,
    prompt: z.string().min(1),
    options: z.array(z.object({ id: Id, text: z.string().min(1) })).min(2),
    correctOptionIds: z.array(Id).min(1),
  })
  .refine((e) => e.correctOptionIds.every((c) => e.options.some((o) => o.id === c)), {
    message: "every correct option must exist",
  });

export const FillBlank = z.object({
  type: z.literal("fill_blank"),
  id: Id,
  skill: LanguageSkill,
  /** Text with numbered gaps: "Je {{0}} étudiant." */
  template: z.string().min(1),
  /** Accepted answers per gap, in gap order. */
  blanks: z.array(z.array(z.string().min(1)).min(1)).min(1),
  matching: TextMatching,
});

export const Matching = z.object({
  type: z.literal("matching"),
  id: Id,
  skill: LanguageSkill,
  prompt: z.string().min(1),
  pairs: z.array(z.object({ id: Id, left: z.string().min(1), right: z.string().min(1) })).min(2),
});

export const WordOrder = z.object({
  type: z.literal("word_order"),
  id: Id,
  skill: LanguageSkill,
  prompt: z.string().min(1),
  /** Tokens in the correct order. The UI shuffles them. */
  tokens: z.array(z.string().min(1)).min(2),
});

export const ExerciseDefinition = z.union([MultipleChoice, FillBlank, Matching, WordOrder]);
export type ExerciseDefinition = z.infer<typeof ExerciseDefinition>;
export type ExerciseType = ExerciseDefinition["type"];

export const ExerciseAnswer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multiple_choice"), selectedOptionIds: z.array(Id) }),
  z.object({ type: z.literal("fill_blank"), values: z.array(z.string()) }),
  z.object({ type: z.literal("matching"), matches: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal("word_order"), tokens: z.array(z.string()) }),
]);
export type ExerciseAnswer = z.infer<typeof ExerciseAnswer>;
