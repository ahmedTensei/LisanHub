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
 * File storage configuration (docs/adr/0005-storage-abstraction.md, ADR 0008).
 * Every file lives in Cloudflare R2 (decision R13); `memory` runs the app and
 * the tests without any storage account. Only the provider, the bucket names
 * and the credentials are configuration: object keys in the database never
 * depend on them.
 */
const StorageEnv = z.object({
  STORAGE_PROVIDER: z.enum(["r2", "memory"]).default("r2"),
  STORAGE_BUCKET_PUBLIC: z.string().min(1).default("lisanhub-public"),
  STORAGE_BUCKET_PRIVATE: z.string().min(1).default("lisanhub-private"),
  R2_ACCOUNT_ID: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_JURISDICTION: z.enum(["", "eu", "fedramp"]).default(""),
  R2_ENDPOINT: z.url().optional(),
  R2_PUBLIC_BASE_URL: z.url().optional(),
});

export type StorageEnv = z.infer<typeof StorageEnv>;

export function readStorageEnv(): StorageEnv {
  return StorageEnv.parse({
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || undefined,
    STORAGE_BUCKET_PUBLIC: process.env.STORAGE_BUCKET_PUBLIC || undefined,
    STORAGE_BUCKET_PRIVATE: process.env.STORAGE_BUCKET_PRIVATE || undefined,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || undefined,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || undefined,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || undefined,
    R2_JURISDICTION: process.env.R2_JURISDICTION || undefined,
    R2_ENDPOINT: process.env.R2_ENDPOINT || undefined,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL || undefined,
  });
}

/** What the R2 provider needs (src/server/storage/r2-provider.ts). */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** "" for the default location, "eu" for the European jurisdiction (buckets are created there too). */
  jurisdiction: "" | "eu" | "fedramp";
  /** Overrides the endpoint derived from the account (MinIO or another S3-compatible store). */
  endpoint?: string;
  buckets: Readonly<Record<"public" | "private", string>>;
  /** Public host of the public bucket (custom domain); when empty, /api/media serves the public store. */
  publicBaseUrl?: string;
}

/** The R2 configuration, or the names of the variables still missing. */
export function readR2Config(
  env: StorageEnv = readStorageEnv(),
): { ok: true; config: R2Config } | { ok: false; missing: string[] } {
  const missing = (["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const).filter((k) => !env[k]);
  if (missing.length > 0 || !env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return { ok: false, missing };
  }
  return {
    ok: true,
    config: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      jurisdiction: env.R2_JURISDICTION,
      endpoint: env.R2_ENDPOINT,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL,
      buckets: { public: env.STORAGE_BUCKET_PUBLIC, private: env.STORAGE_BUCKET_PRIVATE },
    },
  };
}
