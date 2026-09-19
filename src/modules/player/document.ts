/**
 * The player document: one static HTML page whose only script and only
 * stylesheet are inlined and pinned by CSP hashes. Framework-free so the
 * headers can be unit-tested; the /play route serves exactly this.
 */

export const PLAYER_PATH = "/play";

/** The player URL for a given player origin and the platform origin allowed to talk to it. */
export function playerDocumentUrl(playerOrigin: string, platformOrigin: string): string {
  return `${playerOrigin}${PLAYER_PATH}?parent=${encodeURIComponent(platformOrigin)}`;
}

export interface PlayerDocumentInput {
  runtime: string;
  /** Base64 sha256 of `runtime`, as the CSP `script-src` hash. */
  runtimeSha256: string;
  styles: string;
  /** Base64 sha256 of `styles`. */
  stylesSha256: string;
  /** Origins allowed to embed the player (the platform); `'self'` when both share an origin. */
  frameAncestors: string;
}

export function playerHtml(input: PlayerDocumentInput): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>LisanHub player</title>
<style>${input.styles}</style>
</head>
<body>
<div id="root"></div>
<script>${input.runtime}</script>
</body>
</html>
`;
}

/** Everything the frame may do: run its own script, show blob images, talk to nobody. */
export function playerCsp(
  input: Pick<PlayerDocumentInput, "runtimeSha256" | "stylesSha256" | "frameAncestors">,
): string {
  return [
    "default-src 'none'",
    `script-src 'sha256-${input.runtimeSha256}'`,
    `style-src 'sha256-${input.stylesSha256}'`,
    "img-src blob:",
    "connect-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "worker-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${input.frameAncestors}`,
  ].join("; ");
}

export function playerHeaders(
  input: Pick<PlayerDocumentInput, "runtimeSha256" | "stylesSha256" | "frameAncestors">,
): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": playerCsp(input),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=(), payment=(), usb=(), display-capture=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, max-age=600",
  };
}

/** Where the player is served from: a dedicated origin when configured (open decision Q20), else the platform's. */
export function resolvePlayerOrigin(configured: string | undefined, platformOrigin: string): string {
  const value = configured?.trim();
  if (!value) return platformOrigin;
  const url = new URL(value);
  return url.origin;
}

/** The CSP `frame-ancestors` source for the platform embedding the player. */
export function frameAncestorsFor(playerOrigin: string, platformOrigin: string): string {
  return playerOrigin === platformOrigin ? "'self'" : platformOrigin;
}
