import "server-only";

import { headers } from "next/headers";

/**
 * Origin of the current request, used to build the links Supabase puts in
 * emails. Server actions already pass Next.js' Origin/Host CSRF check, so the
 * request headers are a reliable source; a deployment can pin it with SITE_URL.
 */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
