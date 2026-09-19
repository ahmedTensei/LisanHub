// Uploads the platform's reference plugin definitions to the file store (decision R13):
// every row the seeding migration writes names `plugins/core/<plugin_id>-<version>.lisanplugin.json`
// in the private bucket, and this puts the exported file there. Idempotent: an existing
// object is kept when it already holds the same bytes, refused when it differs (a
// published version never changes; export a new version instead). Reads the R2_* values
// from .env.local and prints no secret. Run with `npm run core:plugins:upload`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
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

const env = readEnvLocal();
const accountId = env.R2_ACCOUNT_ID ?? "";
if (!/^[0-9a-f]{32}$/.test(accountId) || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
  console.error("R2 is not configured in .env.local (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
  process.exit(1);
}
const jurisdiction = env.R2_JURISDICTION ?? "";
const endpoint =
  env.R2_ENDPOINT?.replace(/\/+$/, "") ||
  `https://${accountId}.${jurisdiction ? `${jurisdiction}.` : ""}r2.cloudflarestorage.com`;
const bucket = env.STORAGE_BUCKET_PRIVATE || "lisanhub-private";
const client = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const dir = join(root, "plugins", "core");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".lisanplugin.json"))
  .sort();
let failed = 0;
for (const file of files) {
  const text = readFileSync(join(dir, file), "utf8");
  const { plugin_id, version } = JSON.parse(text);
  const key = `plugins/core/${plugin_id}-${version}.lisanplugin.json`;
  const url = `${endpoint}/${bucket}/${key}`;
  const bytes = new TextEncoder().encode(text);
  const localHash = createHash("sha256").update(bytes).digest("hex");

  const existing = await client.fetch(url, { method: "GET" });
  if (existing.status === 200) {
    const remoteHash = createHash("sha256")
      .update(new Uint8Array(await existing.arrayBuffer()))
      .digest("hex");
    if (remoteHash === localHash) {
      console.log(`OK   ${key} — already in the store, identical`);
      continue;
    }
    console.log(`FAIL ${key} — exists with different content; a published version is immutable (export a new version)`);
    failed += 1;
    continue;
  }
  if (existing.status !== 404) {
    console.log(`FAIL ${key} — HTTP ${existing.status} while checking the store`);
    failed += 1;
    continue;
  }
  const put = await client.fetch(url, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": "application/json", "If-None-Match": "*", "x-amz-content-sha256": localHash },
  });
  if (put.ok) console.log(`OK   ${key} — uploaded (${bytes.length} bytes)`);
  else {
    console.log(`FAIL ${key} — HTTP ${put.status}`);
    failed += 1;
  }
}
console.log(`\n${files.length - failed}/${files.length} core plugin files in the store`);
process.exit(failed ? 1 : 0);
