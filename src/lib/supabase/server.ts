import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Server-side Supabase client bound to the signed-in user's session (row level security applies). */
export async function createSupabaseServerClient() {
  const env = readPublicEnv();
  if (!env) throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill it in.");
  const cookieStore = await cookies();

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
