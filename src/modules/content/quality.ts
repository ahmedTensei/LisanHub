export type QualityLabel = "founding_team_reviewed" | "new_community_content" | "community_trusted";

export interface QualitySignals {
  reviewedByFoundingTeam: boolean;
  ratingCount: number;
  averageStars: number;
  seriousOpenReports: number;
}

export interface QualityThresholds {
  communityTrustedMinRatings: number;
  communityTrustedMinAverage: number;
}

/**
 * The lightweight quality tag. Advisory only: it never blocks or delays publication.
 * Thresholds come from platform settings, not constants.
 */
export function deriveQualityLabel(signals: QualitySignals, thresholds: QualityThresholds): QualityLabel {
  if (signals.reviewedByFoundingTeam) return "founding_team_reviewed";
  if (
    signals.seriousOpenReports === 0 &&
    signals.ratingCount >= thresholds.communityTrustedMinRatings &&
    signals.averageStars >= thresholds.communityTrustedMinAverage
  ) {
    return "community_trusted";
  }
  return "new_community_content";
}
