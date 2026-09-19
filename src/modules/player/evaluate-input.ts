import { z } from "zod";
import { ExerciseAnswer } from "@/modules/exercises/definitions";
import { ItemId } from "@/modules/plugins/contract";

/**
 * What the platform accepts from the browser when it computes the
 * authoritative score (ADR 0006 §9): which package, which item, and the
 * learner's answer — nothing else. A result the frame produced has no field
 * to travel in; a payload that carries one is refused before parsing.
 */

export const RESULT_FIELD_NAMES = ["score", "correct", "result", "expected", "evaluation"] as const;

const Envelope = z
  .object({
    /** content_items.id of the package. */
    packageId: z.uuid(),
    /** A published version id, or "draft" for the owner's working copy (preview). */
    version: z.union([z.uuid(), z.literal("draft")]),
    itemId: ItemId,
    answer: z.record(z.string(), z.unknown()),
  })
  .strict();

export interface EvaluateInput {
  packageId: string;
  version: string;
  itemId: string;
  answer: ExerciseAnswer;
}

export type EvaluateInputResult =
  { ok: true; input: EvaluateInput } | { ok: false; code: "invalid" | "result_field_forbidden" };

export function parseEvaluateInput(raw: unknown): EvaluateInputResult {
  const envelope = Envelope.safeParse(raw);
  if (!envelope.success) {
    const offending = raw !== null && typeof raw === "object" && RESULT_FIELD_NAMES.some((k) => k in (raw as object));
    return { ok: false, code: offending ? "result_field_forbidden" : "invalid" };
  }
  if (RESULT_FIELD_NAMES.some((k) => k in envelope.data.answer)) return { ok: false, code: "result_field_forbidden" };
  const answer = ExerciseAnswer.safeParse(envelope.data.answer);
  if (!answer.success) return { ok: false, code: "invalid" };
  return { ok: true, input: { ...envelope.data, answer: answer.data } };
}
