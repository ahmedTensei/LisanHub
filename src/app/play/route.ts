import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { frameAncestorsFor, playerHeaders, playerHtml, resolvePlayerOrigin } from "@/modules/player/document";
import { PLAYER_RUNTIME, PLAYER_RUNTIME_SHA256 } from "@/player/runtime.generated";
import { PLAYER_STYLES } from "@/player/styles";

/**
 * The sandboxed player document (ADR 0006 §5, §9). Served outside the locale
 * tree and outside the proxy: no session refresh, no cookies, one inline
 * script pinned by its hash, and a CSP that forbids every network request.
 * The platform embeds it with `sandbox="allow-scripts"` (no same-origin).
 */

const STYLES_SHA256 = createHash("sha256").update(PLAYER_STYLES).digest("base64");

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const platformOrigin = process.env.SITE_URL?.replace(/\/$/, "") || request.nextUrl.origin;
  const playerOrigin = resolvePlayerOrigin(process.env.PLAYER_ORIGIN, platformOrigin);
  const cspInput = {
    runtimeSha256: PLAYER_RUNTIME_SHA256,
    stylesSha256: STYLES_SHA256,
    frameAncestors: frameAncestorsFor(playerOrigin, platformOrigin),
  };
  const html = playerHtml({ runtime: PLAYER_RUNTIME, styles: PLAYER_STYLES, ...cspInput });
  return new Response(html, { status: 200, headers: playerHeaders(cspInput) });
}
