import { describe, expect, it } from "vitest";
import { ExerciseDefinition } from "./definitions";
import { evaluate, normalizeText } from "./evaluate";

const mcq = ExerciseDefinition.parse({
  type: "multiple_choice",
  id: "q1",
  skill: "reading",
  prompt: "« Bonjour » means…",
  options: [
    { id: "a", text: "صباح الخير" },
    { id: "b", text: "شكرًا" },
  ],
  correctOptionIds: ["a"],
});

const fill = ExerciseDefinition.parse({
  type: "fill_blank",
  id: "q2",
  skill: "writing",
  template: "أنا {{0}}",
  blanks: [["طالب", "طالبة"]],
  matching: { ignoreCase: true, ignoreArabicDiacritics: true },
});

describe("exercise evaluation", () => {
  it("evaluates multiple choice and returns the correct answer on error", () => {
    expect(evaluate(mcq, { type: "multiple_choice", selectedOptionIds: ["a"] })).toMatchObject({
      correct: true,
      score: 1,
    });
    expect(evaluate(mcq, { type: "multiple_choice", selectedOptionIds: ["b"] })).toEqual({
      correct: false,
      score: 0,
      expected: ["a"],
    });
  });

  it("accepts Arabic answers with or without diacritics when configured", () => {
    expect(evaluate(fill, { type: "fill_blank", values: ["طَالِبٌ"] }).correct).toBe(true);
    expect(evaluate(fill, { type: "fill_blank", values: [" طالبة "] }).correct).toBe(true);
    expect(evaluate(fill, { type: "fill_blank", values: ["معلم"] })).toMatchObject({
      correct: false,
      expected: ["طالب"],
    });
  });

  it("gives partial credit for matching and word order", () => {
    const matching = ExerciseDefinition.parse({
      type: "matching",
      id: "q3",
      skill: "reading",
      prompt: "Match",
      pairs: [
        { id: "1", left: "chat", right: "قطة" },
        { id: "2", left: "chien", right: "كلب" },
      ],
    });
    expect(evaluate(matching, { type: "matching", matches: { "1": "1", "2": "1" } }).score).toBe(0.5);

    const order = ExerciseDefinition.parse({
      type: "word_order",
      id: "q4",
      skill: "writing",
      prompt: "Order",
      tokens: ["je", "suis", "ici"],
    });
    expect(evaluate(order, { type: "word_order", tokens: ["je", "suis", "ici"] }).correct).toBe(true);
    expect(evaluate(order, { type: "word_order", tokens: ["suis", "je", "ici"] }).score).toBeCloseTo(1 / 3);
  });

  it("rejects an answer of the wrong type", () => {
    expect(() => evaluate(mcq, { type: "word_order", tokens: [] })).toThrow(/cannot be evaluated/);
  });

  it("rejects definitions whose correct option does not exist", () => {
    const result = ExerciseDefinition.safeParse({ ...mcq, correctOptionIds: ["z"] });
    expect(result.success).toBe(false);
  });

  it("normalises whitespace, case and Unicode forms", () => {
    expect(normalizeText("  Je   SUIS ", { ignoreCase: true, ignoreArabicDiacritics: false })).toBe("je suis");
  });
});
