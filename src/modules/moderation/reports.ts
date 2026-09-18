export type ReportType = "error" | "violation" | "outdated_expression" | "copyright";
export type ReportStatus = "open" | "acknowledged" | "resolved" | "dismissed" | "escalated";

/** Precise location of a report inside a lesson body. */
export interface ReportAnchor {
  blockId: string;
  from?: number;
  to?: number;
}

export interface ContentReport {
  type: ReportType;
  status: ReportStatus;
}

/** Outdated expressions are an ageing signal, not a mistake; they are shown differently to the owner. */
export function isAgeingSignal(type: ReportType): boolean {
  return type === "outdated_expression";
}

/**
 * Repeated justified reports without an owner response move to the moderation queue.
 * The threshold is a platform setting. Mirrors `public.escalate_reports()`.
 */
export function shouldEscalate(reports: readonly ContentReport[], threshold: number): boolean {
  if (reports.some((r) => r.type === "copyright" && r.status === "open")) return true;
  const open = reports.filter((r) => r.status === "open" && r.type !== "copyright").length;
  return open >= threshold;
}
