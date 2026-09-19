import { describe, expect, it } from "vitest";
import type { R2Config } from "@/lib/env";
import { StorageError } from "@/modules/storage/provider";
import { R2StorageProvider, r2Endpoint } from "./r2-provider";

/**
 * The R2 provider against a fake network (decision R13, ADR 0008): the
 * requests it signs, the conditional write behind `upsert`, the error codes
 * the rest of the platform relies on, and the URLs it hands out.
 */

const config: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "AKIAFAKEFAKEFAKEFAKE",
  secretAccessKey: "not-a-real-secret",
  jurisdiction: "eu",
  buckets: { public: "lisanhub-public", private: "lisanhub-private" },
};

interface Seen {
  method: string;
  url: string;
  headers: Headers;
  body: Uint8Array | null;
}

function fakeNetwork(handler: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fetchImpl = async (request: Request) => {
    const body = request.body ? new Uint8Array(await request.arrayBuffer()) : null;
    const entry = { method: request.method, url: request.url, headers: request.headers, body };
    seen.push(entry);
    return handler(entry);
  };
  return { seen, fetchImpl };
}

describe("R2 storage provider", () => {
  it("derives the endpoint from the account and jurisdiction, or takes an override", () => {
    expect(r2Endpoint(config)).toBe("https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com");
    expect(r2Endpoint({ ...config, jurisdiction: "" })).toBe(
      "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    );
    expect(r2Endpoint({ ...config, endpoint: "http://localhost:9000/" })).toBe("http://localhost:9000");
  });

  it("signs every request with SigV4 and writes objects conditionally", async () => {
    const { seen, fetchImpl } = fakeNetwork(() => new Response(null, { status: 200 }));
    const storage = new R2StorageProvider(config, fetchImpl);
    const ref = { store: "private" as const, key: "packages/u1/item-draft.lisanpkg" };

    await storage.upload(ref, new Uint8Array([80, 75, 3, 4]), { contentType: "application/zip" });
    expect(seen[0].method).toBe("PUT");
    expect(seen[0].url).toBe(
      "https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com/lisanhub-private/packages/u1/item-draft.lisanpkg",
    );
    expect(seen[0].headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAFAKEFAKEFAKEFAKE\//);
    expect(seen[0].headers.get("x-amz-content-sha256")).toMatch(/^[0-9a-f]{64}$/);
    expect(seen[0].headers.get("content-type")).toBe("application/zip");
    expect(seen[0].headers.get("if-none-match")).toBe("*");
    expect(seen[0].body).toEqual(new Uint8Array([80, 75, 3, 4]));

    await storage.upload(ref, new Uint8Array([1]), { contentType: "application/zip", upsert: true });
    expect(seen[1].headers.get("if-none-match")).toBeNull();
  });

  it("maps the responses of the object store to the platform's error codes", async () => {
    const statuses = [404, 412, 403, 413, 500];
    const { fetchImpl } = fakeNetwork(() => new Response("x", { status: statuses.shift() ?? 500 }));
    const storage = new R2StorageProvider(config, fetchImpl);
    const ref = { store: "public" as const, key: "avatars/u1/a.png" };
    const codeOf = async (promise: Promise<unknown>) => {
      try {
        await promise;
        return "ok";
      } catch (error) {
        return error instanceof StorageError ? error.code : "other";
      }
    };
    expect(await codeOf(storage.download(ref))).toBe("not_found");
    expect(await codeOf(storage.upload(ref, new Uint8Array(1), { contentType: "image/png" }))).toBe("already_exists");
    expect(await codeOf(storage.download(ref))).toBe("unauthorized");
    expect(await codeOf(storage.upload(ref, new Uint8Array(1), { contentType: "image/png" }))).toBe("too_large");
    expect(await codeOf(storage.download(ref))).toBe("unavailable");
  });

  it("downloads bytes and treats deleting a missing object as done", async () => {
    let calls = 0;
    const { seen, fetchImpl } = fakeNetwork(() => {
      calls += 1;
      return calls === 1 ? new Response(new Uint8Array([9, 8, 7])) : new Response(null, { status: 404 });
    });
    const storage = new R2StorageProvider(config, fetchImpl);
    const ref = { store: "public" as const, key: "avatars/u1/a.png" };
    expect(await storage.download(ref)).toEqual(new Uint8Array([9, 8, 7]));
    await expect(storage.remove([ref])).resolves.toBeUndefined();
    expect(seen[1].method).toBe("DELETE");
  });

  it("serves public objects through the app unless the bucket has a domain, and never by URL for private ones", async () => {
    const storage = new R2StorageProvider(config);
    expect(storage.publicUrl({ store: "public", key: "avatars/u1/a.png" })).toBe("/api/media/avatars/u1/a.png");
    const withDomain = new R2StorageProvider({ ...config, publicBaseUrl: "https://media.example/" });
    expect(withDomain.publicUrl({ store: "public", key: "avatars/u1/a.png" })).toBe(
      "https://media.example/avatars/u1/a.png",
    );
    expect(() => storage.publicUrl({ store: "private", key: "packages/u1/x.lisanpkg" })).toThrow(StorageError);

    const signed = await storage.signedUrl({ store: "private", key: "packages/u1/x.lisanpkg" }, 60);
    const url = new URL(signed);
    expect(url.pathname).toBe("/lisanhub-private/packages/u1/x.lisanpkg");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(signed).not.toContain(config.secretAccessKey);
  });
});
