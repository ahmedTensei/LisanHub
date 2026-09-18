import { z } from "zod";

/**
 * Feedback about the platform itself, collected from founding users while the platform
 * is free (roadmap phase B). Stored in `public.product_feedback`.
 * Content ratings for a single lesson live in the ratings table instead.
 */
export const FEEDBACK_CATEGORIES = ["general", "bug", "idea", "learning", "content", "community"] as const;

export const ProductFeedbackInput = z
  .object({
    score: z.number().int().min(1).max(5).optional(),
    category: z.enum(FEEDBACK_CATEGORIES).default("general"),
    message: z.string().trim().max(4000).optional(),
    pagePath: z.string().max(300).optional(),
  })
  .refine((f) => f.score !== undefined || (f.message !== undefined && f.message.length > 0), {
    message: "a score or a message is required",
  });
export type ProductFeedbackInput = z.infer<typeof ProductFeedbackInput>;

export interface FeedbackSummary {
  responses: number;
  averageScore: number | null;
  byCategory: Record<(typeof FEEDBACK_CATEGORIES)[number], number>;
}

/** Aggregates feedback for the improvement loop (what to fix next). */
export function summarizeFeedback(items: readonly ProductFeedbackInput[]): FeedbackSummary {
  const byCategory = Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c, 0])) as FeedbackSummary["byCategory"];
  let scoreSum = 0;
  let scored = 0;
  for (const item of items) {
    byCategory[item.category] += 1;
    if (item.score !== undefined) {
      scoreSum += item.score;
      scored += 1;
    }
  }
  return { responses: items.length, averageScore: scored ? scoreSum / scored : null, byCategory };
}
