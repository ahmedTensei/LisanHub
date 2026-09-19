import { z } from "zod";

/**
 * Object keys: how the platform names files independently of where they live.
 *
 * The database only ever stores a *relative* key such as
 * `avatars/3f2c…/9b1e….webp`, never a provider URL. The URL is derived at read
 * time by the configured StorageProvider, so moving every file to another
 * provider (Cloudflare R2, S3, …) is a configuration change, not a data
 * migration (docs/adr/0005-storage-abstraction.md).
 */

/** Logical stores; each maps to one bucket of the configured provider. */
export const STORES = ["public", "private"] as const;
export type StoreName = (typeof STORES)[number];

/** Top-level folders. Adding one here documents the convention for everyone. */
export const STORAGE_AREAS = ["avatars", "lesson-media", "exports", "packages", "plugins"] as const;
export type StorageArea = (typeof STORAGE_AREAS)[number];

export const OBJECT_KEY_MAX_LENGTH = 255;

/** Lowercase letters, digits, `/`, `.`, `_`, `-`; no leading slash, no empty or dot-only segments. */
const OBJECT_KEY_PATTERN = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*(?:\/[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)*$/;

export function isObjectKey(value: unknown): value is string {
  return typeof value === "string" && value.length <= OBJECT_KEY_MAX_LENGTH && OBJECT_KEY_PATTERN.test(value);
}

export const ObjectKey = z.string().refine(isObjectKey, "relative object key expected (no leading slash, no '..')");

/** Reference persisted in the database and in content bodies (image blocks, attachments…). */
export const StoredObjectRef = z.object({ store: z.enum(STORES), key: ObjectKey });
export type StoredObjectRef = z.infer<typeof StoredObjectRef>;

/**
 * Accepts keys typed by people or imported from another system: strips a
 * leading slash, lowercases, collapses repeated slashes. Throws on anything
 * that is still not a valid key (path traversal, spaces, unsupported characters).
 */
export function normalizeObjectKey(value: string): string {
  const key = value
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
  if (!isObjectKey(key)) throw new Error(`invalid object key: ${value}`);
  return key;
}

/** Content types the platform accepts, with the extension that names the object. */
export const EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "application/json": "json",
  // A .lisanpkg content package is a zip (ADR 0006).
  "application/zip": "lisanpkg",
};

export function extensionFor(contentType: string): string | null {
  return EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? null;
}

export interface BuildKeyInput {
  area: StorageArea;
  /** Owner of the object (profile id). Every key carries it, so ownership policies can read it from the path. */
  ownerId: string;
  contentType: string;
  /** Stable id of the object; defaults to a fresh UUID. */
  objectId?: string;
}

/** `avatars/<ownerId>/<objectId>.<ext>` — the only layout the platform writes. */
export function buildObjectKey({ area, ownerId, contentType, objectId }: BuildKeyInput): string {
  const extension = extensionFor(contentType);
  if (!extension) throw new Error(`unsupported content type: ${contentType}`);
  const id = objectId ?? crypto.randomUUID();
  return normalizeObjectKey(`${area}/${ownerId}/${id}.${extension}`);
}

/** Reads the owner back from a key written by buildObjectKey; null for foreign layouts. */
export function ownerIdFromKey(key: string): string | null {
  const [area, ownerId, file, ...rest] = key.split("/");
  if (rest.length > 0 || !file || !(STORAGE_AREAS as readonly string[]).includes(area)) return null;
  return ownerId || null;
}
