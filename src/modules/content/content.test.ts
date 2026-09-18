import { describe, expect, it } from "vitest";
import { formatLevel, parseLevel } from "./levels";
import { canTransition } from "./lifecycle";
import { deriveQualityLabel } from "./quality";

describe("proficiency levels", () => {
  it("formats and parses fine-grained CEFR levels", () => {
    expect(formatLevel({ band: "A1", sub: 2 })).toBe("A1.2");
    expect(parseLevel("B2")).toEqual({ band: "B2" });
    expect(parseLevel("C1.3")).toEqual({ band: "C1", sub: 3 });
    expect(parseLevel("intermediate")).toBeNull();
  });
});

describe("content lifecycle", () => {
  it("lets owners publish and archive but not hide", () => {
    expect(canTransition("draft", "published", "owner")).toBe(true);
    expect(canTransition("published", "archived", "owner")).toBe(true);
    expect(canTransition("published", "hidden", "owner")).toBe(false);
    expect(canTransition("hidden", "published", "owner")).toBe(false);
  });

  it("lets moderation hide and restore", () => {
    expect(canTransition("published", "hidden", "moderation")).toBe(true);
    expect(canTransition("hidden", "published", "moderation")).toBe(true);
  });
});

describe("quality label", () => {
  const thresholds = { communityTrustedMinRatings: 10, communityTrustedMinAverage: 4 };

  it("prefers the founding team review", () => {
    expect(
      deriveQualityLabel(
        { reviewedByFoundingTeam: true, ratingCount: 0, averageStars: 0, seriousOpenReports: 2 },
        thresholds,
      ),
    ).toBe("founding_team_reviewed");
  });

  it("marks well-rated content without serious reports as community trusted", () => {
    expect(
      deriveQualityLabel(
        { reviewedByFoundingTeam: false, ratingCount: 12, averageStars: 4.5, seriousOpenReports: 0 },
        thresholds,
      ),
    ).toBe("community_trusted");
    expect(
      deriveQualityLabel(
        { reviewedByFoundingTeam: false, ratingCount: 12, averageStars: 4.5, seriousOpenReports: 1 },
        thresholds,
      ),
    ).toBe("new_community_content");
  });
});
