// Verifies that the app is really wired to the hosted Supabase project:
// auth reachable and configured, every table/view/function the code relies on
// exposed through the API, no leftover storage bucket, and the migration history
// identical locally and remotely. Run with `npm run db:verify` (exit code 1 on
// any failure). Uses only the public values from .env.local.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function readEnvLocal() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) throw new Error(".env.local is missing");
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
  }
  return env;
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

async function main() {
  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  check("env: NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY present", Boolean(url && key), url ?? "");
  if (!url || !key) return;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = (path) => fetch(`${url}${path}`, { headers });

  // Auth service
  const health = await get("/auth/v1/health");
  check("auth: service healthy", health.ok, `HTTP ${health.status}`);
  const settings = await (await get("/auth/v1/settings")).json();
  check("auth: email + password sign-up enabled", settings.external?.email === true && !settings.disable_signup);
  check("auth: email confirmation required (no autoconfirm)", settings.mailer_autoconfirm === false);

  // Data API: everything the application code touches must be exposed. The
  // OpenAPI listing needs a secret key, so each relation and function is probed
  // directly (a missing table answers PGRST205, a missing function PGRST202).
  const relations = [
    "profiles",
    "profile_cards",
    "admin_ranks",
    "language_pairs",
    "languages",
    "content_items",
    "content_versions",
    "course_lessons",
    "progress",
    "review_states",
    "activity_days",
    "reports",
    "feedback",
    "ratings",
    "product_feedback",
    "chat_rooms",
    "chat_messages",
    "notifications",
    "platform_settings",
    "feature_flags",
    "audit_log",
    "support_requests",
    "plugins",
    "plugin_versions",
    "plugin_publish_requests",
  ];
  for (const relation of relations) {
    const res = await get(`/rest/v1/${relation}?select=*&limit=0`);
    check(`api: table/view ${relation}`, res.status === 200, `HTTP ${res.status}`);
  }
  // PostgREST resolves a function by its argument names, so each probe passes the real ones.
  const functions = {
    become_content_creator: {},
    search_languages: { q: "x", max_results: 1 },
    username_available: { p_username: "probe_user" },
    admin_set_primary_role: { p_user: "00000000-0000-0000-0000-000000000000", p_role: "student" },
    admin_set_rank: { p_user: "00000000-0000-0000-0000-000000000000", p_rank: "moderator" },
    resolve_support_request: { p_request: "00000000-0000-0000-0000-000000000000", p_status: "rejected" },
    become_contributor: {},
    submit_plugin_version: {
      p_plugin: "00000000-0000-0000-0000-000000000000",
      p_version: "1.0.0",
      p_schema_version: 1,
      p_definition_key: "plugins/core/probe-1.0.0.lisanplugin.json",
      p_sha256: "0".repeat(64),
    },
    review_plugin_publish_request: { p_request: "00000000-0000-0000-0000-000000000000", p_approve: false },
    set_plugin_disabled: { p_plugin: "00000000-0000-0000-0000-000000000000", p_version: null, p_disabled: true },
    set_plugin_hidden: { p_plugin: "00000000-0000-0000-0000-000000000000", p_hidden: true },
    rollback_content_version: {
      p_item: "00000000-0000-0000-0000-000000000000",
      p_version: "00000000-0000-0000-0000-000000000000",
    },
  };
  for (const [fn, args] of Object.entries(functions)) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const body = await res.json().catch(() => ({}));
    check(`api: function ${fn}`, body?.code !== "PGRST202" && res.status !== 404, `HTTP ${res.status}`);
  }
  // Plugin definitions are files (decision R13): no document column may remain in the database.
  for (const [relation, column] of [
    ["plugin_versions", "definition"],
    ["plugins", "draft"],
    ["plugin_publish_requests", "definition"],
  ]) {
    const res = await get(`/rest/v1/${relation}?select=${column}&limit=0`);
    check(
      `schema: ${relation} has no ${column} column (definitions live in the store)`,
      res.status === 400,
      `HTTP ${res.status}`,
    );
  }
  for (const column of [
    "username",
    "display_name",
    "ui_locale",
    "visibility",
    "primary_role",
    "is_founding_member",
    "avatar_key",
    "bio",
    "location",
  ]) {
    const res = await get(`/rest/v1/profiles?select=${column}&limit=0`);
    check(`schema: profiles.${column}`, res.status === 200, `HTTP ${res.status}`);
  }

  // Behaviour probes (anonymous): reference data readable, private data not writable.
  const kab = await (
    await fetch(`${url}/rest/v1/rpc/search_languages`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ q: "kab", max_results: 1 }),
    })
  ).json();
  check("data: search_languages('kab') -> Kabyle", Array.isArray(kab) && kab[0]?.code === "kab");
  const free = await (
    await fetch(`${url}/rest/v1/rpc/username_available`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_username: "abc" }),
    })
  ).json();
  check("data: username_available rejects 3-character handles", free === false);

  const plugins = await (await get("/rest/v1/plugins?select=plugin_id,status&order=plugin_id")).json();
  check(
    "data: core plugins classic-exercises and vocab-cards are published (S2)",
    Array.isArray(plugins) &&
      ["classic-exercises", "vocab-cards"].every((id) =>
        plugins.some((p) => p.plugin_id === id && p.status === "published"),
      ),
    JSON.stringify(plugins).slice(0, 120),
  );
  const limits = await (await get("/rest/v1/platform_settings?select=key&key=like.packages.*")).json();
  check(
    "data: package limits are settings (packages.max_*)",
    Array.isArray(limits) && limits.length === 4,
    JSON.stringify(limits),
  );
  for (const column of ["plugin_id", "package_key", "package_sha256", "items_count"]) {
    const res = await get(`/rest/v1/content_items?select=${column}&limit=0`);
    check(`schema: content_items.${column}`, res.status === 200, `HTTP ${res.status}`);
  }
  const body = await get("/rest/v1/content_versions?select=body&limit=0");
  check(
    "schema: content_versions has no body column (content lives in packages)",
    body.status === 400,
    `HTTP ${body.status}`,
  );
  const anonInsert = await fetch(`${url}/rest/v1/language_pairs`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000", native_lang: "arq", target_lang: "fra" }),
  });
  check("rls: anonymous cannot insert language pairs", anonInsert.status === 401 || anonInsert.status === 403);

  // No file in Supabase Storage: every file lives in Cloudflare R2 (decision R13, ADR 0008).
  // A former bucket is either gone or empty and closed to writes.
  for (const bucket of ["media-public", "media-private"]) {
    const list = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1 }),
    });
    const listed = list.status === 200 ? await list.json().catch(() => []) : [];
    const upload = await fetch(`${url}/storage/v1/object/${bucket}/probe/verify.txt`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "text/plain" },
      body: "probe",
    });
    const gone = list.status !== 200;
    check(
      `storage: bucket ${bucket} ${gone ? "is gone" : "is empty and closed"}`,
      gone || (Array.isArray(listed) && listed.length === 0 && upload.status !== 200),
      gone ? `HTTP ${list.status}` : `list ${listed.length} object(s), upload HTTP ${upload.status}`,
    );
  }

  // Migration history: local files == local history == remote history.
  const files = readdirSync(join(root, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, 14))
    .sort();
  let list;
  try {
    const out = execSync("npx --yes supabase@2.117.0 migration list --linked --output-format json", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    list = JSON.parse(out.slice(out.indexOf("{")));
  } catch (error) {
    check("migrations: could read remote history (supabase link + login)", false, String(error.message).slice(0, 120));
  }
  if (list) {
    const local = list.migrations
      .map((m) => m.local)
      .filter(Boolean)
      .sort();
    const remote = list.migrations
      .map((m) => m.remote)
      .filter(Boolean)
      .sort();
    check(
      "migrations: every local file is in the history",
      JSON.stringify(files) === JSON.stringify(local),
      local.join(","),
    );
    check(
      "migrations: remote history matches local",
      JSON.stringify(local) === JSON.stringify(remote),
      remote.join(","),
    );
  }
}

try {
  await main();
} catch (error) {
  check("verification ran", false, String(error.message));
}

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
