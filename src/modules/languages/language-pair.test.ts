import { describe, expect, it } from "vitest";
import { LanguagePair, pairKey, rankByDialectPreference } from "./language-pair";

describe("language pairs", () => {
  it("accepts any ISO 639-3 pair, including less widely spoken languages", () => {
    expect(LanguagePair.parse({ native: "kab", target: "fra" })).toEqual({ native: "kab", target: "fra" });
    expect(pairKey({ native: "fra", target: "arb", dialect: "maghrebi" })).toBe("fra>arb");
  });

  it("rejects two-letter codes and malformed dialect tags", () => {
    expect(LanguagePair.safeParse({ native: "fr", target: "ar" }).success).toBe(false);
    expect(LanguagePair.safeParse({ native: "fra", target: "arb", dialect: "Egyptian Arabic" }).success).toBe(false);
  });

  it("prioritises the preferred dialect without excluding others", () => {
    const items = [
      { id: 1, targetLang: "arb", dialectTag: "levantine" },
      { id: 2, targetLang: "arb", dialectTag: "maghrebi" },
      { id: 3, targetLang: "arb", dialectTag: null },
    ];
    const ranked = rankByDialectPreference(items, "maghrebi");
    expect(ranked.map((i) => i.id)).toEqual([2, 1, 3]);
    expect(ranked).toHaveLength(items.length);
  });
});
