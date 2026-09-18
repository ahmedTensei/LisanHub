import type { StoredObjectRef } from "./keys";
import { StorageError, type StorageBody, type StorageProvider, type UploadOptions } from "./provider";

interface StoredObject {
  bytes: Uint8Array;
  contentType: string;
}

async function toBytes(body: StorageBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(await body.arrayBuffer());
}

/**
 * In-memory provider for tests and for running the app without any storage
 * configured. Behaves exactly like a real provider at the interface level.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = "memory";
  private readonly objects = new Map<string, StoredObject>();

  constructor(private readonly baseUrl = "memory://storage") {}

  private id(ref: StoredObjectRef): string {
    return `${ref.store}/${ref.key}`;
  }

  async upload(ref: StoredObjectRef, body: StorageBody, options: UploadOptions): Promise<void> {
    const id = this.id(ref);
    if (this.objects.has(id) && !options.upsert) throw new StorageError("already_exists", id);
    this.objects.set(id, { bytes: await toBytes(body), contentType: options.contentType });
  }

  async remove(refs: readonly StoredObjectRef[]): Promise<void> {
    for (const ref of refs) this.objects.delete(this.id(ref));
  }

  publicUrl(ref: StoredObjectRef): string {
    if (ref.store !== "public") throw new StorageError("unauthorized", "private objects need a signed url");
    return `${this.baseUrl}/public/${ref.key}`;
  }

  async signedUrl(ref: StoredObjectRef, expiresInSeconds: number): Promise<string> {
    if (!this.objects.has(this.id(ref))) throw new StorageError("not_found", this.id(ref));
    return `${this.baseUrl}/${ref.store}/${ref.key}?expires=${expiresInSeconds}`;
  }

  /** Test helper. */
  get(ref: StoredObjectRef): StoredObject | undefined {
    return this.objects.get(this.id(ref));
  }
}
