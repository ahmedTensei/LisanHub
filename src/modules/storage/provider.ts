import type { StoredObjectRef } from "./keys";

/**
 * The boundary between the platform and wherever files live. Application code
 * only ever talks to this interface; provider implementations (Supabase
 * Storage today, S3/R2 later) are chosen by configuration in src/server/storage.
 *
 * Rules every implementation follows:
 *  - keys are relative (see keys.ts); the provider adds bucket and host;
 *  - `publicUrl` never touches the network and is only valid for the public store;
 *  - objects in the private store are reached through short-lived signed URLs;
 *  - errors are thrown as StorageError with a stable code.
 */
export type StorageErrorCode = "not_found" | "already_exists" | "unauthorized" | "too_large" | "unavailable";

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "StorageError";
  }
}

export type StorageBody = Blob | ArrayBuffer | Uint8Array;

export interface UploadOptions {
  contentType: string;
  /** Seconds a CDN or browser may cache the object; public assets get a long value. */
  cacheControlSeconds?: number;
  /** Replace an existing object instead of failing with `already_exists`. */
  upsert?: boolean;
}

export interface StorageProvider {
  /** Configuration name (`supabase`, `s3`, `memory`), for diagnostics only. */
  readonly name: string;
  upload(ref: StoredObjectRef, body: StorageBody, options: UploadOptions): Promise<void>;
  remove(refs: readonly StoredObjectRef[]): Promise<void>;
  /** Stable URL of an object in the public store. */
  publicUrl(ref: StoredObjectRef): string;
  /** Time-limited URL for reading an object, in any store. */
  signedUrl(ref: StoredObjectRef, expiresInSeconds: number): Promise<string>;
}
