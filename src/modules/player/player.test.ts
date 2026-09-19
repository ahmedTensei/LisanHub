import { describe, expect, it } from "vitest";
import { authorable, playability } from "@/modules/plugins/playable";
import { z } from "zod";
import { FORBIDDEN_MESSAGE_FIELDS, PlatformToPlayer, PlayerToPlatform } from "./bridge";
import { playerDocumentUrl } from "./document";
import { parseEvaluateInput } from "./evaluate-input";

/** Every property name reachable in a schema, for the no-user-data test. */
function propertyNamesOf(schema: z.core.$ZodType): string[] {
  const names = new Set<string>();
  const walk = (node: unknown) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record.properties && typeof record.properties === "object") {
      for (const key of Object.keys(record.properties as object)) names.add(key);
    }
    for (const value of Object.values(record)) walk(value);
  };
  walk(z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any" }));
  return [...names].sort();
}

describe("player bridge (ADR 0006 §5)", () => {
  it("carries no user data in any direction", () => {
    for (const schema of [PlatformToPlayer, PlayerToPlatform]) {
      const names = propertyNamesOf(schema);
      expect(names.length).toBeGreaterThan(5);
      const leaked = names.filter((n) => (FORBIDDEN_MESSAGE_FIELDS as readonly string[]).includes(n.toLowerCase()));
      expect(leaked).toEqual([]);
    }
  });

  it("accepts only the five player messages and the three platform messages", () => {
    expect(PlayerToPlatform.safeParse({ type: "ready" }).success).toBe(true);
    expect(PlayerToPlatform.safeParse({ type: "height", px: 320 }).success).toBe(true);
    expect(PlayerToPlatform.safeParse({ type: "height", px: -1 }).success).toBe(false);
    expect(PlayerToPlatform.safeParse({ type: "result", correct: true, score: 1 }).success).toBe(true);
    expect(PlayerToPlatform.safeParse({ type: "result", correct: true, score: 2 }).success).toBe(false);
    expect(PlayerToPlatform.safeParse({ type: "progress", value: 1 }).success).toBe(false);
    expect(PlayerToPlatform.safeParse({ type: "error", code: "render_failed" }).success).toBe(true);
    expect(PlatformToPlayer.safeParse({ type: "check" }).success).toBe(true);
    expect(PlatformToPlayer.safeParse({ type: "reset" }).success).toBe(true);
    expect(PlatformToPlayer.safeParse({ type: "render" }).success).toBe(false);
    expect(PlatformToPlayer.safeParse({ type: "eval", code: "1+1" }).success).toBe(false);
  });

  it("builds the player URL from the configured origin, pinned to the platform origin", () => {
    expect(playerDocumentUrl("https://player.example.org", "https://app.example.org")).toBe(
      "https://player.example.org/play?parent=https%3A%2F%2Fapp.example.org",
    );
  });
});

describe("authoritative evaluation input", () => {
  const base = {
    packageId: "6f1d1c2e-1234-4abc-9def-1234567890ab",
    version: "draft",
    itemId: "item-0001",
    answer: { type: "multiple_choice", selectedOptionIds: ["a"] },
  };

  it("accepts a package, an item and an answer — nothing else", () => {
    const ok = parseEvaluateInput(base);
    expect(ok.ok).toBe(true);
    expect(parseEvaluateInput({ ...base, extra: 1 })).toEqual({ ok: false, code: "invalid" });
    expect(parseEvaluateInput({ ...base, answer: { type: "unknown" } })).toEqual({ ok: false, code: "invalid" });
  });

  it("refuses any score or result coming from the browser (a frame result is never stored)", () => {
    expect(parseEvaluateInput({ ...base, score: 1 })).toEqual({ ok: false, code: "result_field_forbidden" });
    expect(parseEvaluateInput({ ...base, result: { correct: true } })).toEqual({
      ok: false,
      code: "result_field_forbidden",
    });
    expect(parseEvaluateInput({ ...base, answer: { ...base.answer, correct: true } })).toEqual({
      ok: false,
      code: "result_field_forbidden",
    });
    expect(parseEvaluateInput({ ...base, answer: { ...base.answer, score: 1 } })).toEqual({
      ok: false,
      code: "result_field_forbidden",
    });
  });
});

describe("kill switch", () => {
  const live = { status: "published" as const, disabled: false, disabledMessage: {} };

  it("blocks playback of a disabled plugin or version with the translated message, and keeps hidden plugins playing", () => {
    expect(playability(live, { disabled: false }, "ar")).toEqual({ ok: true });
    expect(
      playability(
        { ...live, disabled: true, disabledMessage: { ar: "معطّلة", fr: "Désactivée" } },
        { disabled: false },
        "fr",
      ),
    ).toEqual({
      ok: false,
      reason: "plugin_disabled",
      message: "Désactivée",
    });
    expect(playability(live, { disabled: true }, "ar")).toEqual({
      ok: false,
      reason: "version_disabled",
      message: null,
    });
    expect(playability({ ...live, status: "hidden" }, { disabled: false }, "ar")).toEqual({ ok: true });
    expect(playability({ ...live, status: "draft" }, { disabled: false }, "ar")).toMatchObject({
      ok: false,
      reason: "plugin_not_published",
    });
  });

  it("removes disabled and hidden plugins from authoring", () => {
    expect(authorable(live)).toBe(true);
    expect(authorable({ ...live, disabled: true })).toBe(false);
    expect(authorable({ ...live, status: "hidden" })).toBe(false);
  });
});
