import { z } from "zod";
import { ExerciseDefinition } from "@/modules/exercises/definitions";

export const LESSON_SCHEMA_VERSION = 1;

const BlockId = z.string().min(1).max(64);

export const LessonBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("explanation"), id: BlockId, text: z.string().min(1).max(20_000) }),
  z.object({
    type: z.literal("vocabulary"),
    id: BlockId,
    items: z
      .array(
        z.object({
          id: BlockId,
          term: z.string().min(1),
          meaning: z.string().min(1),
          example: z.string().optional(),
        }),
      )
      .min(1),
  }),
  z.object({ type: z.literal("example"), id: BlockId, source: z.string().min(1), translation: z.string().optional() }),
  z.object({ type: z.literal("exercise"), id: BlockId, exercise: ExerciseDefinition }),
]);
export type LessonBlock = z.infer<typeof LessonBlock>;

/** Body stored in `content_versions.body` for lessons. */
export const LessonBody = z
  .object({
    schemaVersion: z.literal(LESSON_SCHEMA_VERSION),
    blocks: z.array(LessonBlock),
  })
  .refine((body) => new Set(body.blocks.map((b) => b.id)).size === body.blocks.length, {
    message: "block ids must be unique",
  });
export type LessonBody = z.infer<typeof LessonBody>;

/** Quick-start template so a new lesson never begins as a blank page. */
export function lessonStarterTemplate(): LessonBody {
  return {
    schemaVersion: LESSON_SCHEMA_VERSION,
    blocks: [
      { type: "explanation", id: "intro", text: "…" },
      { type: "vocabulary", id: "words", items: [{ id: "w1", term: "…", meaning: "…" }] },
      { type: "example", id: "example-1", source: "…" },
    ],
  };
}
