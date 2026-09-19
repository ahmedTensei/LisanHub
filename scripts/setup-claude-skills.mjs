// One-time local setup, run by Claude Code on a new machine: npm run setup
//
// Remote tools cannot write .claude, .github or .vscode, so the project keeps their
// sources in visible folders and this script installs them locally:
//   claude-skills/   -> .claude/skills/   (the 19 project skills for Claude Code)
//   setup/github/    -> .github/          (CI workflow)
//   setup/vscode/    -> .vscode/          (editor settings)
// The visible folders stay the source of truth; re-run after changing them.
//
// It also removes files that earlier versions of the project shipped and that no
// longer belong to it (listed in STALE_PATHS), because remote tools cannot delete files.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const STALE_PATHS = [
  // Removed by decision R2: no subscriptions or entitlements before the final stage.
  join("src", "modules", "entitlements"),
  // Renamed to platform-security so it stops overriding Claude Code's built-in /security-review.
  join("claude-skills", "security-review"),
  join(".claude", "skills", "security-review"),
];

for (const stale of STALE_PATHS) {
  const target = join(root, stale);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`removed stale ${stale}`);
  }
}

const targets = [
  { from: "claude-skills", to: join(".claude", "skills") },
  { from: join("setup", "github"), to: ".github" },
  { from: join("setup", "vscode"), to: ".vscode" },
];

for (const { from, to } of targets) {
  const source = join(root, from);
  if (!existsSync(source)) {
    console.warn(`skipped ${from} (not found)`);
    continue;
  }
  mkdirSync(join(root, to), { recursive: true });
  cpSync(source, join(root, to), { recursive: true, force: true });
  console.log(`installed ${from} -> ${to} (${readdirSync(source).length} entries)`);
}
