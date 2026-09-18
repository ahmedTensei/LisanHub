import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import { FORM_ERROR_CODES } from "@/modules/account/schemas";

/**
 * Every literal translation call in the source must resolve in the catalogue,
 * so a raw key such as "account.profile.publicLink" can never reach the screen
 * (Ahmed, 2026-09-17). Dynamic keys (template literals) are checked by the
 * runtime tests of the pages that use them.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

function resolve(key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, ar);
}

const src = join(__dirname, "..");
const files = walk(src);

describe("translation keys used in the source", () => {
  it("all exist in the Arabic catalogue", () => {
    const missing: string[] = [];
    for (const file of files) {
      // Each function declares its own `t`, so namespaces are resolved per function body.
      const chunks = readFileSync(file, "utf8").split(/\n(?=(?:export )?(?:async )?function )/);
      for (const code of chunks) {
        // const tName = useTranslations("ns") | await getTranslations("ns") | getTranslations({ namespace: "ns" })
        const namespaces = new Map<string, string>();
        for (const m of code.matchAll(
          /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?"([^"]+)"/g,
        )) {
          namespaces.set(m[1], m[2]);
        }
        // const [t, tOther] = await Promise.all([getTranslations("a"), getTranslations("b"), …])
        for (const m of code.matchAll(/const\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\[([\s\S]*?)\]\);/g)) {
          const names = m[1].split(",").map((s) => s.trim());
          const calls = [
            ...m[2].matchAll(/(?:getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)|([a-zA-Z]+\([^)]*\)|[^,]+)/g),
          ];
          let index = 0;
          for (const call of calls) {
            const text = call[0].trim();
            if (!text) continue;
            const ns = text.match(/(?:getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)/);
            if (ns && names[index]) namespaces.set(names[index], ns[1]);
            index += 1;
          }
        }
        for (const [name, ns] of namespaces) {
          for (const call of code.matchAll(new RegExp(`(?<![\\w.])${name}\\(\\s*"([^"]+)"`, "g"))) {
            const key = `${ns}.${call[1]}`;
            const value = resolve(key);
            if (typeof value !== "string") missing.push(`${file.replace(src, "src")}: ${key}`);
          }
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it("translate every error and outcome code the actions can return", () => {
    const expectKeys = (group: string, codes: readonly string[]) => {
      const node = resolve(group) as Record<string, unknown> | undefined;
      const absent = codes.filter((code) => typeof node?.[code] !== "string");
      expect(absent, group).toEqual([]);
    };
    expectKeys("forms.errors", FORM_ERROR_CODES);
    expectKeys("auth.errors", [
      "invalid_credentials",
      "email_not_confirmed",
      "weak_password",
      "same_password",
      "email_exists",
      "rate_limited",
      "signup_disabled",
      "sign_in_required",
      "link_expired",
      "link_invalid",
      "other_browser",
      "unexpected",
    ]);
    expectKeys("account.errors", [
      "sign_in_required",
      "not_allowed",
      "already_content_creator",
      "role_change_not_allowed",
      "pair_exists",
      "acknowledge_required",
      "request_pending",
      "upload_failed",
      "unexpected",
    ]);
    expectKeys("admin.errors", [
      "staff_only",
      "administrator_required",
      "super_administrator_required",
      "owner_only",
      "own_rank",
      "invalid_input",
      "already_closed",
      "sign_in_required",
      "unexpected",
    ]);
    expectKeys("admin.outcomes", [
      "in_review",
      "resolved",
      "rejected",
      "role_set",
      "rank_set",
      "setting_saved",
      "flag_saved",
      "feedback_triaged",
      "report_updated",
    ]);
  });
});
