"use client";

import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export function createSupabaseBrowserClient() {
  const env = readPublicEnv();
  if (!env) throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill it in.");
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
