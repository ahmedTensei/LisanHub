import { z } from "zod";

/**
 * Requests members send to support from inside the platform. Handled in the
 * administration area; returning to Student is executed by the database
 * function when an Administrator resolves the request (decision R4).
 */
export const SUPPORT_REQUEST_KINDS = ["revert_to_student", "other"] as const;
export type SupportRequestKind = (typeof SUPPORT_REQUEST_KINDS)[number];

export const SUPPORT_REQUEST_STATUSES = ["open", "in_review", "resolved", "rejected"] as const;
export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number];

export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

export const SupportRequestInput = z.object({
  kind: z.enum(SUPPORT_REQUEST_KINDS, { error: "kind_invalid" }),
  message: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
    z.string().max(SUPPORT_MESSAGE_MAX_LENGTH, { error: "message_too_long" }).optional(),
  ),
});
export type SupportRequestInput = z.infer<typeof SupportRequestInput>;

/** Decisions staff may take on a pending request; "open" is never chosen by hand. */
export const SUPPORT_DECISIONS = ["in_review", "resolved", "rejected"] as const;
export type SupportDecision = (typeof SUPPORT_DECISIONS)[number];

export function isPending(status: SupportRequestStatus): boolean {
  return status === "open" || status === "in_review";
}
