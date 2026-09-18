import "server-only";

import { readStorageEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MemoryStorageProvider } from "@/modules/storage/memory-provider";
import type { StorageProvider } from "@/modules/storage/provider";
import { SupabaseStorageProvider } from "./supabase-provider";

let memory: MemoryStorageProvider | null = null;

/**
 * The storage provider selected by configuration (STORAGE_PROVIDER). Feature
 * code receives a StorageProvider and never imports a vendor SDK, so moving
 * files to Cloudflare R2 or S3 means adding a provider here and changing
 * environment variables — not touching features or the database
 * (docs/adr/0005-storage-abstraction.md).
 */
export async function getStorage(): Promise<StorageProvider> {
  const env = readStorageEnv();
  switch (env.STORAGE_PROVIDER) {
    case "supabase":
      return new SupabaseStorageProvider(await createSupabaseServerClient(), {
        public: env.STORAGE_BUCKET_PUBLIC,
        private: env.STORAGE_BUCKET_PRIVATE,
      });
    case "memory":
      memory ??= new MemoryStorageProvider();
      return memory;
    case "s3":
      // Reserved: implement src/server/storage/s3-provider.ts against the S3 API
      // (works for Cloudflare R2, MinIO, AWS) when the team decides to move.
      throw new Error("STORAGE_PROVIDER=s3 is not implemented yet (docs/adr/0005-storage-abstraction.md)");
  }
}
