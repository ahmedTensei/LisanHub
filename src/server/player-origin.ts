import "server-only";

import { playerDocumentUrl, resolvePlayerOrigin } from "@/modules/player/document";
import { siteOrigin } from "./site-url";

/** The player document URL for the current request: PLAYER_ORIGIN when configured (Q20), else the platform's origin. */
export async function playerUrlForRequest(): Promise<string> {
  const platformOrigin = await siteOrigin();
  return playerDocumentUrl(resolvePlayerOrigin(process.env.PLAYER_ORIGIN, platformOrigin), platformOrigin);
}
