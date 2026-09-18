import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { readPublicEnv } from "./lib/env";

const handleI18nRouting = createMiddleware(routing);

/**
 * 1. Negotiates the interface locale (next-intl).
 * 2. When Supabase is configured, refreshes the auth session cookie.
 * Authorization is never decided here: it happens in server code and row level security.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  const env = readPublicEnv();
  if (!env) return response;

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
