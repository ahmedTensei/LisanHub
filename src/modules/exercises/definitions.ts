import * as z from "zod/mini";
import { LanguageSkill } from "@/modules/content/levels";

// zod/mini: this module is bundled into the sandboxed player (ADR 0007).

const Id = z.string().check(z.minLength(1), z.maxLength(64));
const NonEmpty = z.string().check(z.minLength(1));

const TextMatching = z._default(
  z.object({
    /** Ignore letter case (Latin, Cyrillic, ...). */
    ignoreCase: z._default(z.boolean(), true),
    /** Ignore Arabic short vowels (harakat) and tatweel when comparing answers. */
    ignoreArabicDiacritics: z._default(z.boolean(), false),
  }),
  { ignoreCase: true, ignoreArabicDiacritics: false },
);

export const MultipleChoice = z
  .object({
    type: z.literal("multiple_choice"),
    id: Id,
    skill: LanguageSkill,
    prompt: NonEmpty,
    options: z.array(z.object({ id: Id, text: NonEmpty })).check(z.minLength(2)),
    correctOptionIds: z.array(Id).check(z.minLength(1)),
  })
  .check(
    z.refine((e) => e.correctOptionIds.every((c) => e.options.some((o) => o.id === c)), {
      message: "every correct option must exist",
    }),
  );

export const FillBlank = z.object({
  type: z.literal("fill_blank"),
  id: Id,
  skill: LanguageSkill,
  /** Text with numbered gaps: "Je {{0}} étudiant." */
  template: NonEmpty,
  /** Accepted answers per gap, in gap order. */
  blanks: z.array(z.array(NonEmpty).check(z.minLength(1))).check(z.minLength(1)),
  matching: TextMatching,
});

export const Matching = z.object({
  type: z.literal("matching"),
  id: Id,
  skill: LanguageSkill,
  prompt: NonEmpty,
  pairs: z.array(z.object({ id: Id, left: NonEmpty, right: NonEmpty })).check(z.minLength(2)),
});

export const WordOrder = z.object({
  type: z.literal("word_order"),
  id: Id,
  skill: LanguageSkill,
  prompt: NonEmpty,
  /** Tokens in the correct order. The UI shuffles them. */
  tokens: z.array(NonEmpty).check(z.minLength(2)),
});

/** How a learner rates their own recall of a card (decision R11: vocabulary cards are self-assessed). */
export const SELF_RATINGS = ["again", "hard", "good", "easy"] as const;
export type SelfRating = (typeof SELF_RATINGS)[number];

/** Score each rating maps to; "good" and "easy" count as correct. The spaced-repetition domain reads the rating itself. */
export const SELF_RATING_SCORES: Readonly<Record<SelfRating, number>> = { again: 0, hard: 0.5, good: 0.8, easy: 1 };

export const SelfAssessment = z.object({
  type: z.literal("self_assessment"),
  id: Id,
  skill: LanguageSkill,
  /** What the learner sees first. */
  front: NonEmpty,
  /** Revealed on request; the learner then rates their recall. */
  back: NonEmpty,
});

export const ExerciseDefinition = z.union([MultipleChoice, FillBlank, Matching, WordOrder, SelfAssessment]);
export type ExerciseDefinition = z.infer<typeof ExerciseDefinition>;
export type ExerciseType = ExerciseDefinition["type"];

export const ExerciseAnswer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multiple_choice"), selectedOptionIds: z.array(Id) }),
  z.object({ type: z.literal("fill_blank"), values: z.array(z.string()) }),
  z.object({ type: z.literal("matching"), matches: z.record(z.string(), z.string()) }),
  z.object({ type: z.literal("word_order"), tokens: z.array(z.string()) }),
  z.object({ type: z.literal("self_assessment"), rating: z.enum(SELF_RATINGS) }),
]);
export type ExerciseAnswer = z.infer<typeof ExerciseAnswer>;
