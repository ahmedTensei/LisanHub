import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StoredObjectRef, StoreName } from "@/modules/storage/keys";
import { StorageError, type StorageBody, type StorageProvider, type UploadOptions } from "@/modules/storage/provider";

export type BucketMap = Readonly<Record<StoreName, string>>;

interface ProviderError {
  message: string;
  status?: number;
  statusCode?: string;
}

function toStorageError(error: ProviderError): StorageError {
  const status = error.status ?? Number(error.statusCode);
  if (status === 404) return new StorageError("not_found", error.message);
  if (status === 409) return new StorageError("already_exists", error.message);
  if (status === 401 || status === 403) return new StorageError("unauthorized", error.message);
  if (status === 413) return new StorageError("too_large", error.message);
  return new StorageError("unavailable", error.message);
}

/**
 * Supabase Storage behind the platform's StorageProvider interface. The client
 * carries the caller's session, so bucket policies (row level security on
 * storage.objects) decide what each user may write and read.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase";

  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly buckets: BucketMap,
  ) {}

  private bucket(store: StoreName) {
    return this.client.storage.from(this.buckets[store]);
  }

  async upload(ref: StoredObjectRef, body: StorageBody, options: UploadOptions): Promise<void> {
    const { error } = await this.bucket(ref.store).upload(ref.key, body, {
      contentType: options.contentType,
      cacheControl: String(options.cacheControlSeconds ?? 3600),
      upsert: options.upsert ?? false,
    });
    if (error) throw toStorageError(error);
  }

  async remove(refs: readonly StoredObjectRef[]): Promise<void> {
    const byStore = new Map<StoreName, string[]>();
    for (const ref of refs) byStore.set(ref.store, [...(byStore.get(ref.store) ?? []), ref.key]);
    for (const [store, keys] of byStore) {
      const { error } = await this.bucket(store).remove(keys);
      if (error) throw toStorageError(error);
    }
  }

  publicUrl(ref: StoredObjectRef): string {
    if (ref.store !== "public") throw new StorageError("unauthorized", "private objects need a signed url");
    return this.bucket(ref.store).getPublicUrl(ref.key).data.publicUrl;
  }

  async signedUrl(ref: StoredObjectRef, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.bucket(ref.store).createSignedUrl(ref.key, expiresInSeconds);
    if (error) throw toStorageError(error);
    return data.signedUrl;
  }
}
