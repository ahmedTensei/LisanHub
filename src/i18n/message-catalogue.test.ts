import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { ADMIN_RANKS, VIEW_AS_OPTIONS } from "@/modules/authorization/roles";
import { CONTENT_STATUSES } from "@/modules/content/lifecycle";
import { LANGUAGE_SKILLS } from "@/modules/content/levels";
import { FEEDBACK_CATEGORIES } from "@/modules/feedback/product-feedback";
import { FEATURE_MODES, SETTING_FIELDS, settingMessageKey } from "@/modules/platform/settings";
import { EVALUATORS, FIELD_TYPES } from "@/modules/plugins/fields";
import { PLAYABILITY_REASONS } from "@/modules/plugins/playable";
import { SUPPORT_REQUEST_KINDS, SUPPORT_REQUEST_STATUSES } from "@/modules/support/requests";

/**
 * Dynamic translation keys (`t(\`fields.${key}.label\`)`) escape the literal
 * check in message-usage.test.ts, and a wrong mapping shows a raw key such as
 * "admin.settings.fields.__________.label" on screen (Ahmed, 2026-09-18).
 * Two guards close that hole:
 *
 * 1. Every template-literal key in the source, with each `${…}` treated as one
 *    wildcard segment, must match at least one key of the catalogue — a typo in
 *    the fixed part of the key fails here.
 * 2. Every enumeration a module exports and a page turns into a key is expanded
 *    value by value against the three catalogues, through the same mapping
 *    function the page uses (settingMessageKey, …).
 *
 * The runtime guard is src/i18n/request.ts: outside production a missing
 * message throws instead of rendering its key.
 */

const catalogues = { ar, fr, en } as const;

function keysOf(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

const arKeys = keysOf(ar);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

const src = join(__dirname, "..");

/** Splits a comma-separated list at depth zero of (), [] and {}. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if ("([{".includes(ch)) depth += 1;
    if (")]}".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out.filter((entry) => entry !== "");
}

/** Every `t` variable and its namespace, per function body (same rules as message-usage.test.ts). */
function namespacesIn(code: string): Map<string, string> {
  const namespaces = new Map<string, string>();
  for (const m of code.matchAll(
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?"([^"]+)"/g,
  )) {
    namespaces.set(m[1], m[2]);
  }
  for (const m of code.matchAll(/const\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.all\(\[([\s\S]*?)\]\);/g)) {
    const names = splitTopLevel(m[1]);
    splitTopLevel(m[2]).forEach((text, index) => {
      const ns = text.match(/(?:getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)/);
      if (ns && names[index] && /^\w+$/.test(names[index])) namespaces.set(names[index], ns[1]);
    });
  }
  return namespaces;
}

function patternMatches(pattern: string): boolean {
  const parts = pattern.split(".");
  const regex = new RegExp(
    `^${parts.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+")).join("\\.")}$`,
  );
  return arKeys.some((key) => regex.test(key));
}

describe("dynamic translation keys", () => {
  it("every template-literal key matches the shape of the catalogue", () => {
    const unmatched: string[] = [];
    for (const file of walk(src)) {
      const chunks = readFileSync(file, "utf8").split(/\n(?=(?:export )?(?:async )?function )/);
      for (const code of chunks) {
        for (const [name, ns] of namespacesIn(code)) {
          for (const call of code.matchAll(new RegExp(`(?<![\\w.])${name}\\(\\s*\`([^\`]+)\``, "g"))) {
            const pattern = `${ns}.${call[1].replace(/\$\{[^}]*\}/g, "*")}`;
            if (!patternMatches(pattern)) unmatched.push(`${file.replace(src, "src")}: ${pattern}`);
          }
        }
      }
    }
    expect([...new Set(unmatched)]).toEqual([]);
  });

  it("every enumeration the pages translate exists in the three catalogues", () => {
    const missing: string[] = [];
    const expectKeys = (group: string, codes: readonly string[]) => {
      for (const [locale, catalogue] of Object.entries(catalogues)) {
        const node = group
          .split(".")
          .reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], catalogue);
        for (const code of codes) {
          const value = (node as Record<string, unknown> | undefined)?.[code];
          if (typeof value !== "string" || value.trim() === "") missing.push(`${locale}: ${group}.${code}`);
        }
      }
    };

    // Administration: settings and feature switches (decision R6).
    for (const [key, field] of Object.entries(SETTING_FIELDS)) {
      const messageKey = settingMessageKey(key as keyof typeof SETTING_FIELDS);
      expect(messageKey, key).not.toContain(".");
      expectKeys(
        `admin.settings.fields.${messageKey}`,
        field.kind === "boolean" ? ["label", "description", "on", "off"] : ["label", "description"],
      );
    }
    for (const [key, modes] of Object.entries(FEATURE_MODES)) {
      expectKeys(`admin.settings.flags.${key}`, ["label", "description"]);
      expectKeys(`admin.settings.flags.${key}.modes`, modes);
    }
    // Members, ranks and "view as" (decisions R5, R6).
    expectKeys("admin.users.ranks", [...ADMIN_RANKS, "none"]);
    expectKeys("viewAs.options", VIEW_AS_OPTIONS);
    // Support, feedback (decision R5).
    expectKeys("account.support.kinds", SUPPORT_REQUEST_KINDS);
    expectKeys("account.support.statuses", SUPPORT_REQUEST_STATUSES);
    expectKeys("admin.requests.kinds", SUPPORT_REQUEST_KINDS);
    expectKeys("admin.requests.statuses", SUPPORT_REQUEST_STATUSES);
    expectKeys("admin.feedback.categories", FEEDBACK_CATEGORIES);
    // Content editor and studio (decisions R7, R10).
    expectKeys("editor.statuses", CONTENT_STATUSES);
    expectKeys("editor.preview.paused", PLAYABILITY_REASONS);
    expectKeys("studio.fieldTypes", FIELD_TYPES);
    expectKeys("studio.activity.evaluators", EVALUATORS);
    expectKeys("studio.skills", LANGUAGE_SKILLS);

    expect(missing).toEqual([]);
  });
});
