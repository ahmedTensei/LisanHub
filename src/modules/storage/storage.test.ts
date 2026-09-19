import { describe, expect, it } from "vitest";
import { buildObjectKey, extensionFor, isObjectKey, normalizeObjectKey, ownerIdFromKey, StoredObjectRef } from "./keys";
import { MemoryStorageProvider } from "./memory-provider";
import { StorageError } from "./provider";

describe("object keys", () => {
  it("are relative paths, never provider urls", () => {
    expect(isObjectKey("avatars/3f2c/9b1e.webp")).toBe(true);
    expect(isObjectKey("/avatars/3f2c/9b1e.webp")).toBe(false);
    expect(isObjectKey("https://xyz.supabase.co/storage/v1/object/public/a.png")).toBe(false);
    expect(isObjectKey("avatars/../secrets")).toBe(false);
    expect(isObjectKey("avatars//x.png")).toBe(false);
    expect(isObjectKey("avatars/x y.png")).toBe(false);
    expect(isObjectKey("a".repeat(256))).toBe(false);
  });

  it("normalizes keys written by people", () => {
    expect(normalizeObjectKey("/Users/Avatars//123.JPG")).toBe("users/avatars/123.jpg");
    expect(() => normalizeObjectKey("../etc/passwd")).toThrow(/invalid object key/);
  });

  it("builds keys as area/owner/id.ext from the content type", () => {
    const key = buildObjectKey({ area: "avatars", ownerId: "3f2c", contentType: "image/webp", objectId: "9b1e" });
    expect(key).toBe("avatars/3f2c/9b1e.webp");
    expect(ownerIdFromKey(key)).toBe("3f2c");
    expect(ownerIdFromKey("elsewhere/3f2c/9b1e.webp")).toBeNull();
    expect(extensionFor("image/svg+xml")).toBeNull();
    expect(() => buildObjectKey({ area: "avatars", ownerId: "3f2c", contentType: "image/svg+xml" })).toThrow(
      /unsupported content type/,
    );
  });

  it("validates references stored in content bodies", () => {
    expect(StoredObjectRef.safeParse({ store: "public", key: "lesson-media/o/1.png" }).success).toBe(true);
    expect(StoredObjectRef.safeParse({ store: "public", key: "https://x/1.png" }).success).toBe(false);
    expect(StoredObjectRef.safeParse({ store: "cdn", key: "lesson-media/o/1.png" }).success).toBe(false);
  });
});

describe("storage provider contract (memory implementation)", () => {
  const ref = { store: "public", key: "avatars/u1/a.png" } as const;
  const secret = { store: "private", key: "exports/u1/data.json" } as const;

  it("uploads, refuses silent overwrites, and derives urls from keys", async () => {
    const storage = new MemoryStorageProvider("https://cdn.example");
    await storage.upload(ref, new Uint8Array([1, 2, 3]), { contentType: "image/png" });
    await expect(storage.upload(ref, new Uint8Array([4]), { contentType: "image/png" })).rejects.toMatchObject({
      code: "already_exists",
    });
    await storage.upload(ref, new Uint8Array([4]), { contentType: "image/png", upsert: true });
    expect(storage.get(ref)?.bytes).toEqual(new Uint8Array([4]));
    expect(storage.publicUrl(ref)).toBe("https://cdn.example/avatars/u1/a.png");
  });

  it("keeps private objects behind signed urls only", async () => {
    const storage = new MemoryStorageProvider();
    await storage.upload(secret, new TextEncoder().encode("{}"), { contentType: "application/json" });
    expect(() => storage.publicUrl(secret)).toThrow(StorageError);
    await expect(storage.signedUrl(secret, 60)).resolves.toMatch(/exports\/u1\/data\.json\?expires=60$/);
    await storage.remove([secret]);
    await expect(storage.signedUrl(secret, 60)).rejects.toMatchObject({ code: "not_found" });
  });
});
