import { SELF_RATING_SCORES, type ExerciseAnswer, type ExerciseDefinition } from "./definitions";

export interface Evaluation {
  correct: boolean;
  /** 0..1 partial credit. */
  score: number;
  /** Shown when the answer is wrong: correction, never punishment. */
  expected: unknown;
}

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalizeText(
  value: string,
  options: { ignoreCase: boolean; ignoreArabicDiacritics: boolean },
): string {
  let text = value.normalize("NFC").trim().replace(/\s+/g, " ");
  if (options.ignoreArabicDiacritics) text = text.replace(ARABIC_DIACRITICS, "");
  if (options.ignoreCase) text = text.toLocaleLowerCase();
  return text;
}

class AnswerTypeMismatch extends Error {
  constructor(expected: string, received: string) {
    super(`answer of type "${received}" cannot be evaluated against a "${expected}" exercise`);
  }
}

/** Deterministic evaluation. Presentation components never contain this logic. */
export function evaluate(exercise: ExerciseDefinition, answer: ExerciseAnswer): Evaluation {
  if (exercise.type !== answer.type) throw new AnswerTypeMismatch(exercise.type, answer.type);

  switch (exercise.type) {
    case "multiple_choice": {
      const selected = new Set((answer as Extract<ExerciseAnswer, { type: "multiple_choice" }>).selectedOptionIds);
      const correct = new Set(exercise.correctOptionIds);
      const hits = [...selected].filter((id) => correct.has(id)).length;
      const wrong = selected.size - hits;
      const isCorrect = hits === correct.size && wrong === 0;
      const score = Math.max(0, (hits - wrong) / correct.size);
      return { correct: isCorrect, score: isCorrect ? 1 : score, expected: exercise.correctOptionIds };
    }

    case "fill_blank": {
      const values = (answer as Extract<ExerciseAnswer, { type: "fill_blank" }>).values;
      const results = exercise.blanks.map((accepted, i) => {
        const given = normalizeText(values[i] ?? "", exercise.matching);
        return accepted.some((a) => normalizeText(a, exercise.matching) === given);
      });
      const hits = results.filter(Boolean).length;
      return {
        correct: hits === exercise.blanks.length,
        score: hits / exercise.blanks.length,
        expected: exercise.blanks.map((accepted) => accepted[0]),
      };
    }

    case "matching": {
      const matches = (answer as Extract<ExerciseAnswer, { type: "matching" }>).matches;
      const hits = exercise.pairs.filter((p) => matches[p.id] === p.id).length;
      return {
        correct: hits === exercise.pairs.length,
        score: hits / exercise.pairs.length,
        expected: Object.fromEntries(exercise.pairs.map((p) => [p.left, p.right])),
      };
    }

    case "word_order": {
      const tokens = (answer as Extract<ExerciseAnswer, { type: "word_order" }>).tokens;
      const hits = exercise.tokens.filter((t, i) => tokens[i] === t).length;
      const isCorrect = hits === exercise.tokens.length && tokens.length === exercise.tokens.length;
      return { correct: isCorrect, score: isCorrect ? 1 : hits / exercise.tokens.length, expected: exercise.tokens };
    }

    case "self_assessment": {
      const rating = (answer as Extract<ExerciseAnswer, { type: "self_assessment" }>).rating;
      const score = SELF_RATING_SCORES[rating];
      return { correct: score >= SELF_RATING_SCORES.good, score, expected: exercise.back };
    }
  }
}
