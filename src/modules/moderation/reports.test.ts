import { describe, expect, it } from "vitest";
import { isAgeingSignal, shouldEscalate } from "./reports";

describe("reports", () => {
  it("escalates once open reports reach the configured threshold", () => {
    const open = { type: "error", status: "open" } as const;
    expect(shouldEscalate([open, open], 3)).toBe(false);
    expect(shouldEscalate([open, open, open], 3)).toBe(true);
  });

  it("ignores reports the owner already handled", () => {
    const handled = { type: "error", status: "resolved" } as const;
    expect(shouldEscalate([handled, handled, handled], 3)).toBe(false);
  });

  it("sends copyright reports straight to moderation", () => {
    expect(shouldEscalate([{ type: "copyright", status: "open" }], 3)).toBe(true);
  });

  it("treats outdated expressions as an ageing signal", () => {
    expect(isAgeingSignal("outdated_expression")).toBe(true);
    expect(isAgeingSignal("error")).toBe(false);
  });
});
