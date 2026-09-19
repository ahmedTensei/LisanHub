// Produces plugins/core/*.lisanplugin.json from scripts/core-plugins.ts through
// the studio's own pipeline, then prints each definition's sha256. The seeding
// migration embeds these files; tests/db/core-plugins.test.ts checks the hashes.
// Run: node scripts/build-core-plugins.mjs
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(root, ".tmp-core-plugins");
mkdirSync(tmp, { recursive: true });
const out = join(tmp, "core-plugins.mjs");

await build({
  entryPoints: [join(root, "scripts", "core-plugins.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: ["node22"],
  outfile: out,
  tsconfig: join(root, "tsconfig.json"),
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "warning",
});

try {
  execFileSync(process.execPath, [out], { cwd: root, stdio: "inherit" });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
