import { describe, expect, it } from "vitest";
import { shouldNotifyDerivations, upwardChain, type LineageNode } from "./lineage";

const nodes: Record<string, LineageNode> = {
  original: { itemId: "original", title: "Greetings (fr>arb)", ownerId: "a", derivedFromItemId: null, available: true },
  copy1: { itemId: "copy1", title: "Greetings (en>arb)", ownerId: "b", derivedFromItemId: "original", available: true },
  copy2: { itemId: "copy2", title: "Greetings (en>arq)", ownerId: "c", derivedFromItemId: "copy1", available: true },
  sibling: {
    itemId: "sibling",
    title: "Greetings (es>arb)",
    ownerId: "d",
    derivedFromItemId: "original",
    available: true,
  },
};

describe("content lineage", () => {
  it("returns only the personal upward chain", () => {
    const chain = upwardChain("copy2", (id) => nodes[id]);
    expect(chain.map((n) => n.itemId)).toEqual(["copy2", "copy1", "original"]);
    expect(chain.some((n) => n.itemId === "sibling")).toBe(false);
  });

  it("stops at a removed source instead of failing", () => {
    const chain = upwardChain("copy2", (id) => (id === "copy1" ? undefined : nodes[id]));
    expect(chain.map((n) => n.itemId)).toEqual(["copy2"]);
  });

  it("is safe against corrupted cycles", () => {
    const cyclic: Record<string, LineageNode> = {
      x: { ...nodes.original, itemId: "x", derivedFromItemId: "y" },
      y: { ...nodes.original, itemId: "y", derivedFromItemId: "x" },
    };
    expect(upwardChain("x", (id) => cyclic[id])).toHaveLength(2);
  });

  it("notifies the original owner once when the threshold is crossed", () => {
    expect(shouldNotifyDerivations(9, 10, 10)).toBe(true);
    expect(shouldNotifyDerivations(10, 11, 10)).toBe(false);
  });
});
