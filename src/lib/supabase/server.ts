import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Server-side Supabase client bound to the signed-in user's session (row level security applies). */
export async function createSupabaseServerClient() {
  // Read the cookies first: a page that needs a session is rendered per request, never
  // prerendered at build time, so a build without Supabase values (CI) still succeeds.
  const cookieStore = await cookies();
  const env = readPublicEnv();
  if (!env) throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill it in.");

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: session refresh is handled in the proxy.
        }
      },
    },
  });
}
