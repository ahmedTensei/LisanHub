import { z } from "zod";

const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof PublicEnv>;

/**
 * Returns the Supabase public configuration, or null while the project is not
 * connected yet. The app must run without it so development can start before S1.
 */
export function readPublicEnv(): PublicEnv | null {
  const parsed = PublicEnv.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

export function isSupabaseConfigured(): boolean {
  return readPublicEnv() !== null;
}

/**
 * File storage configuration (docs/adr/0005-storage-abstraction.md). Only the
 * provider and bucket names are configuration; object keys in the database
 * never depend on them.
 */
const StorageEnv = z.object({
  STORAGE_PROVIDER: z.enum(["supabase", "memory", "s3"]).default("supabase"),
  STORAGE_BUCKET_PUBLIC: z.string().min(1).default("media-public"),
  STORAGE_BUCKET_PRIVATE: z.string().min(1).default("media-private"),
});

export type StorageEnv = z.infer<typeof StorageEnv>;

export function readStorageEnv(): StorageEnv {
  return StorageEnv.parse({
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || undefined,
    STORAGE_BUCKET_PUBLIC: process.env.STORAGE_BUCKET_PUBLIC || undefined,
    STORAGE_BUCKET_PRIVATE: process.env.STORAGE_BUCKET_PRIVATE || undefined,
  });
}
