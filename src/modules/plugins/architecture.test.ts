import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural rules of decision R7 that no code review should have to remember:
 *  - platform code never imports a plugin definition file (they are data;
 *    the exported core definitions live outside `src/` in `plugins/core/`);
 *  - the server never listens to the player bridge, so a score reported by
 *    the sandboxed frame has no path into persistence.
 */
const root = join(__dirname, "..", "..", "..");
const src = join(root, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return /\.(ts|tsx|mts|js|mjs)$/.test(name) && !name.endsWith(".generated.ts") ? [path] : [];
  });
}

const IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

function importsOf(file: string): string[] {
  const specs: string[] = [];
  for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) specs.push(match[1]);
  return specs;
}

describe("plugin boundary (decision R7)", () => {
  const files = walk(src);

  it("never imports a plugin definition file into platform code", () => {
    const offenders = files.filter((file) =>
      importsOf(file).some(
        (spec) =>
          /(^|\/)plugins\/core(\/|$)/.test(spec) ||
          spec.endsWith(".lisanplugin.json") ||
          spec.endsWith(".lisanpkg") ||
          /^(\.\.\/)+plugins\//.test(spec) ||
          spec.startsWith("@/../plugins"),
      ),
    );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("keeps the player bridge out of the server: a frame result can never be stored", () => {
    const serverFiles = files.filter((f) => f.startsWith(join(src, "server")));
    const offenders = serverFiles.filter((file) =>
      importsOf(file).some((spec) => /modules\/player\/bridge/.test(spec)),
    );
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });

  it("keeps the exported core definitions outside src/", () => {
    const inside = files.filter((f) => f.endsWith(".lisanplugin.json"));
    expect(inside).toEqual([]);
  });
});
