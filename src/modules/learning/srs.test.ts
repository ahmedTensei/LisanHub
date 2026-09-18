import { describe, expect, it } from "vitest";
import { isDue, newReviewState, review } from "./srs";

describe("spaced repetition", () => {
  const start = new Date("2026-09-17T08:00:00Z");

  it("creates a card that is due immediately", () => {
    expect(isDue(newReviewState("lesson-1:w1", start), start)).toBe(true);
  });

  it("schedules a good answer further out than a forgotten one", () => {
    const card = newReviewState("lesson-1:w1", start);
    const good = review(card, "good", start);
    const again = review(card, "again", start);
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
    expect(good.reps).toBe(1);
  });

  it("counts lapses when a learned card is forgotten", () => {
    let card = newReviewState("lesson-1:w2", start);
    let now = start;
    for (let i = 0; i < 4; i++) {
      card = review(card, "easy", now);
      now = new Date(card.due);
    }
    const forgotten = review(card, "again", now);
    expect(forgotten.lapses).toBe(card.lapses + 1);
  });
});
