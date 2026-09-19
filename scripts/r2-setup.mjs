// Prepares and verifies the Cloudflare R2 account the platform stores its files in
// (decision R13, ADR 0008). Reads the R2_* values from .env.local, creates the two
// buckets when they are missing (this needs an API token with "Admin Read & Write";
// "Object Read & Write" is enough once they exist), then writes, reads back and
// deletes one probe object in each bucket. Prints a checklist; never prints a
// secret. Run with `npm run storage:verify` (exit code 1 on any failure).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readEnvLocal() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) throw new Error(".env.local is missing");
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].trim();
  }
  return env;
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

async function main() {
  const env = readEnvLocal();
  const accountId = env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY ?? "";
  const jurisdiction = env.R2_JURISDICTION ?? "";
  const buckets = {
    public: env.STORAGE_BUCKET_PUBLIC || "lisanhub-public",
    private: env.STORAGE_BUCKET_PRIVATE || "lisanhub-private",
  };

  check("env: STORAGE_PROVIDER=r2", (env.STORAGE_PROVIDER || "r2") === "r2", env.STORAGE_PROVIDER ?? "(default)");
  check("env: R2_ACCOUNT_ID looks like an account id (32 hex characters)", /^[0-9a-f]{32}$/.test(accountId));
  check("env: R2_ACCESS_KEY_ID present", accessKeyId.length > 0);
  check("env: R2_SECRET_ACCESS_KEY present", secretAccessKey.length > 0);
  check("env: R2_JURISDICTION is empty, eu or fedramp", ["", "eu", "fedramp"].includes(jurisdiction), jurisdiction);
  if (!/^[0-9a-f]{32}$/.test(accountId) || !accessKeyId || !secretAccessKey) return;

  const endpoint =
    env.R2_ENDPOINT?.replace(/\/+$/, "") ||
    `https://${accountId}.${jurisdiction ? `${jurisdiction}.` : ""}r2.cloudflarestorage.com`;
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  // One retry on a network-level failure (a reset on the first TLS connection is not a configuration error).
  const send = async (path, init = {}) => {
    try {
      return await client.fetch(`${endpoint}/${path}`, init);
    } catch {
      return client.fetch(`${endpoint}/${path}`, init);
    }
  };

  for (const [store, bucket] of Object.entries(buckets)) {
    // Does the bucket exist? HEAD answers 200 (yes), 404 (no) or 403 (token cannot see it).
    let head = await send(bucket, { method: "HEAD" });
    if (head.status === 404) {
      const created = await send(bucket, { method: "PUT" });
      check(
        `r2: bucket ${bucket} (${store}) created`,
        created.ok,
        created.ok ? "" : `HTTP ${created.status} — creating buckets needs a token with Admin Read & Write`,
      );
      head = await send(bucket, { method: "HEAD" });
    }
    check(`r2: bucket ${bucket} (${store}) reachable`, head.status === 200, `HTTP ${head.status}`);
    if (head.status !== 200) continue;

    const key = `probe/${Date.now()}.txt`;
    const body = new TextEncoder().encode("lisanhub storage probe");
    const put = await send(`${bucket}/${key}`, {
      method: "PUT",
      body,
      headers: { "Content-Type": "text/plain", "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
    });
    check(`r2: ${bucket} accepts a write`, put.ok, `HTTP ${put.status}`);
    const got = await send(`${bucket}/${key}`);
    const text = got.ok ? await got.text() : "";
    check(`r2: ${bucket} reads it back unchanged`, got.ok && text === "lisanhub storage probe", `HTTP ${got.status}`);
    const del = await send(`${bucket}/${key}`, { method: "DELETE" });
    check(`r2: ${bucket} deletes it`, del.ok, `HTTP ${del.status}`);
  }

  if (env.R2_PUBLIC_BASE_URL) {
    check("env: R2_PUBLIC_BASE_URL is https", /^https:\/\//.test(env.R2_PUBLIC_BASE_URL), env.R2_PUBLIC_BASE_URL);
  } else {
    check("public pictures are served by /api/media (no public bucket domain configured)", true);
  }
}

main()
  .catch((error) => {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
    check("run", false, (error instanceof Error ? error.message : String(error)) + cause);
  })
  .finally(() => {
    for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed`);
    process.exit(failed ? 1 : 0);
  });
