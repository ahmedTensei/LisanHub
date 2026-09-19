import "server-only";

import { AwsClient } from "aws4fetch";
import type { R2Config } from "@/lib/env";
import { sha256Hex } from "@/modules/plugins/hash";
import type { StoredObjectRef } from "@/modules/storage/keys";
import { StorageError, type StorageBody, type StorageProvider, type UploadOptions } from "@/modules/storage/provider";

export type R2Fetch = (input: Request) => Promise<Response>;

export function r2Endpoint(config: Pick<R2Config, "accountId" | "jurisdiction" | "endpoint">): string {
  if (config.endpoint) return config.endpoint.replace(/\/+$/, "");
  const zone = config.jurisdiction ? `${config.jurisdiction}.` : "";
  return `https://${config.accountId}.${zone}r2.cloudflarestorage.com`;
}

async function toBytes(body: StorageBody): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  return new Uint8Array(await body.arrayBuffer());
}

function toStorageError(status: number, detail: string): StorageError {
  if (status === 404) return new StorageError("not_found", detail);
  if (status === 412 || status === 409) return new StorageError("already_exists", detail);
  if (status === 401 || status === 403) return new StorageError("unauthorized", detail);
  if (status === 413) return new StorageError("too_large", detail);
  return new StorageError("unavailable", `${status} ${detail}`.trim());
}

/**
 * Cloudflare R2 through its S3-compatible API, signed with SigV4 by aws4fetch
 * (decision R13, ADR 0008). Every file of the platform lives here — packages,
 * package assets, profile pictures — while Supabase keeps accounts and
 * metadata only. R2 knows nothing about members: the server is the single
 * gatekeeper, so every read and write passes through an action or a route
 * that checked the actor first (src/server/packages/access.ts, the account
 * actions), and the private store is never exposed by URL.
 */
export class R2StorageProvider implements StorageProvider {
  readonly name = "r2";
  private readonly client: AwsClient;
  private readonly endpoint: string;

  constructor(
    private readonly config: R2Config,
    private readonly fetchImpl?: R2Fetch,
  ) {
    this.endpoint = r2Endpoint(config);
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: "s3",
      region: "auto",
    });
  }

  private url(ref: StoredObjectRef): string {
    return `${this.endpoint}/${this.config.buckets[ref.store]}/${ref.key}`;
  }

  private async send(ref: StoredObjectRef, init: RequestInit): Promise<Response> {
    const request = await this.client.sign(this.url(ref), init);
    const response = this.fetchImpl ? await this.fetchImpl(request) : await fetch(request);
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      throw toStorageError(response.status, detail);
    }
    return response;
  }

  async upload(ref: StoredObjectRef, body: StorageBody, options: UploadOptions): Promise<void> {
    const bytes = await toBytes(body);
    const headers: Record<string, string> = {
      "Content-Type": options.contentType,
      "Cache-Control": `public, max-age=${options.cacheControlSeconds ?? 3600}`,
      // Signed payload: the store refuses bytes that do not match the hash in the signature.
      "x-amz-content-sha256": sha256Hex(bytes),
    };
    // Conditional write: the object must not exist yet unless the caller asked to replace it.
    if (!options.upsert) headers["If-None-Match"] = "*";
    await this.send(ref, { method: "PUT", body: bytes as BodyInit, headers });
  }

  async download(ref: StoredObjectRef): Promise<Uint8Array> {
    const response = await this.send(ref, { method: "GET" });
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(refs: readonly StoredObjectRef[]): Promise<void> {
    for (const ref of refs) {
      try {
        await this.send(ref, { method: "DELETE" });
      } catch (error) {
        // Deleting what is already gone is not a failure.
        if (!(error instanceof StorageError && error.code === "not_found")) throw error;
      }
    }
  }

  publicUrl(ref: StoredObjectRef): string {
    if (ref.store !== "public") throw new StorageError("unauthorized", "private objects need a signed url");
    const base = this.config.publicBaseUrl?.replace(/\/+$/, "");
    return base ? `${base}/${ref.key}` : `/api/media/${ref.key}`;
  }

  async signedUrl(ref: StoredObjectRef, expiresInSeconds: number): Promise<string> {
    const url = new URL(this.url(ref));
    url.searchParams.set("X-Amz-Expires", String(Math.max(1, Math.min(expiresInSeconds, 7 * 24 * 3600))));
    const signed = await this.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  }
}
