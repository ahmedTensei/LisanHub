import "server-only";

import { readR2Config, readStorageEnv } from "@/lib/env";
import { MemoryStorageProvider } from "@/modules/storage/memory-provider";
import { StorageError, type StorageProvider } from "@/modules/storage/provider";
import { R2StorageProvider } from "./r2-provider";

let memory: MemoryStorageProvider | null = null;
let r2: R2StorageProvider | null = null;

/**
 * The storage provider selected by configuration (STORAGE_PROVIDER). Feature
 * code receives a StorageProvider and never imports a vendor SDK, so the move
 * from Supabase Storage to Cloudflare R2 (decision R13, ADR 0008) touched this
 * file and the environment only — not features, not the database
 * (docs/adr/0005-storage-abstraction.md).
 */
export async function getStorage(): Promise<StorageProvider> {
  const env = readStorageEnv();
  switch (env.STORAGE_PROVIDER) {
    case "r2": {
      if (r2) return r2;
      const read = readR2Config(env);
      if (!read.ok) {
        throw new StorageError(
          "unavailable",
          `Cloudflare R2 is not configured: set ${read.missing.join(", ")} in .env.local (docs/SETUP.md), or STORAGE_PROVIDER=memory for a session without files`,
        );
      }
      r2 = new R2StorageProvider(read.config);
      return r2;
    }
    case "memory":
      memory ??= new MemoryStorageProvider();
      return memory;
  }
}
