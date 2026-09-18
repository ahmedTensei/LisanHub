import { describe, expect, it } from "vitest";
import { ProductFeedbackInput, summarizeFeedback } from "./product-feedback";

describe("product feedback", () => {
  it("accepts a score alone or a message alone", () => {
    expect(ProductFeedbackInput.safeParse({ score: 5 }).success).toBe(true);
    expect(ProductFeedbackInput.safeParse({ message: "The review session is great" }).success).toBe(true);
  });

  it("rejects empty feedback and out-of-range scores", () => {
    expect(ProductFeedbackInput.safeParse({ message: "   " }).success).toBe(false);
    expect(ProductFeedbackInput.safeParse({ score: 6 }).success).toBe(false);
  });

  it("summarises responses for the improvement loop", () => {
    const items = [
      ProductFeedbackInput.parse({ score: 4, category: "idea" }),
      ProductFeedbackInput.parse({ score: 2, category: "bug", message: "Audio stops" }),
      ProductFeedbackInput.parse({ message: "More Kabyle lessons", category: "content" }),
    ];
    const summary = summarizeFeedback(items);
    expect(summary.responses).toBe(3);
    expect(summary.averageScore).toBe(3);
    expect(summary.byCategory).toMatchObject({ idea: 1, bug: 1, content: 1, general: 0 });
  });
});
