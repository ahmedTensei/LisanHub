// Verifies that the app is really wired to the hosted Supabase project:
// auth reachable and configured, every table/view/function the code relies on
// exposed through the API, storage buckets present, and the migration history
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
    storage_object_owner: { object_name: "avatars/owner/file.png" },
    admin_set_primary_role: { p_user: "00000000-0000-0000-0000-000000000000", p_role: "student" },
    admin_set_rank: { p_user: "00000000-0000-0000-0000-000000000000", p_rank: "moderator" },
    resolve_support_request: { p_request: "00000000-0000-0000-0000-000000000000", p_status: "rejected" },
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
  const anonInsert = await fetch(`${url}/rest/v1/language_pairs`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000000", native_lang: "arq", target_lang: "fra" }),
  });
  check("rls: anonymous cannot insert language pairs", anonInsert.status === 401 || anonInsert.status === 403);

  // Storage buckets (ADR 0005)
  for (const bucket of ["media-public", "media-private"]) {
    const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1 }),
    });
    check(`storage: bucket ${bucket} exists`, res.status === 200, `HTTP ${res.status}`);
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
