import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PLAYER_RUNTIME, PLAYER_RUNTIME_SHA256 } from "@/player/runtime.generated";
import { PLAYER_STYLES } from "@/player/styles";
import { frameAncestorsFor, playerCsp, playerHeaders, playerHtml, resolvePlayerOrigin } from "./document";

const base64 = (text: string) => createHash("sha256").update(text).digest("base64");

describe("player document (ADR 0006 §5)", () => {
  const input = { runtimeSha256: PLAYER_RUNTIME_SHA256, stylesSha256: base64(PLAYER_STYLES), frameAncestors: "'self'" };

  it("pins its only script and stylesheet by hash and forbids every network request", () => {
    expect(PLAYER_RUNTIME_SHA256).toBe(base64(PLAYER_RUNTIME));
    const csp = playerCsp(input);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain(`script-src 'sha256-${PLAYER_RUNTIME_SHA256}'`);
    expect(csp).toContain("img-src blob:");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'self'");
  });

  it("sends no cookies, no referrer and no permissions with the document", () => {
    const headers = playerHeaders(input);
    expect(headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("microphone=()");
    expect(headers["Permissions-Policy"]).toContain("clipboard-read=()");
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("set-cookie");
  });

  it("contains exactly one inline script (the runtime) and no external references", () => {
    const html = playerHtml({ runtime: PLAYER_RUNTIME, styles: PLAYER_STYLES, ...input });
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toMatch(/<script[^>]*src=/);
    expect(html).not.toMatch(/<link/);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("resolves the player origin from configuration, defaulting to the platform's own", () => {
    expect(resolvePlayerOrigin(undefined, "https://app.example.org")).toBe("https://app.example.org");
    expect(resolvePlayerOrigin("", "https://app.example.org")).toBe("https://app.example.org");
    expect(resolvePlayerOrigin("https://player.example.org/", "https://app.example.org")).toBe(
      "https://player.example.org",
    );
    expect(frameAncestorsFor("https://app.example.org", "https://app.example.org")).toBe("'self'");
    expect(frameAncestorsFor("https://player.example.org", "https://app.example.org")).toBe("https://app.example.org");
  });

  it("bundles no network, storage or clipboard access into the runtime", () => {
    for (const forbidden of [
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "navigator.clipboard",
      "WebSocket",
      "document.cookie",
      "eval(",
    ]) {
      expect(PLAYER_RUNTIME, forbidden).not.toContain(forbidden);
    }
  });
});
