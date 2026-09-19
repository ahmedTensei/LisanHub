import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import { FORM_ERROR_CODES } from "@/modules/account/schemas";
import { PACKAGE_ISSUE_CODES } from "@/modules/packages/validate";
import { PLAYER_STRING_KEYS } from "@/modules/player/bridge";
import { DEFINITION_ISSUE_CODES } from "@/modules/plugins/generate";
import { PLAYABILITY_REASONS } from "@/modules/plugins/playable";

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

/** Splits a comma-separated list at depth zero of (), [] and {}; entries are trimmed and non-empty. */
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
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter((entry) => entry !== "");
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
          // Both lists are split at top-level commas only: destructured objects ({ a, b }) and nested calls (f(x, y)) keep their place.
          const names = splitTopLevel(m[1]);
          const calls = splitTopLevel(m[2]);
          calls.forEach((text, index) => {
            const ns = text.match(/(?:getTranslations|useTranslations)\(\s*"([^"]+)"\s*\)/);
            if (ns && names[index] && /^\w+$/.test(names[index])) namespaces.set(names[index], ns[1]);
          });
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
      "reason_required",
      "moderation_only",
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
      "plugin_approved",
      "plugin_rejected",
      "plugin_disabled",
      "plugin_enabled",
      "plugin_hidden",
      "plugin_shown",
      "content_hidden",
      "content_restored",
    ]);
    // S2: studio, content editor and player (decision R7).
    expectKeys("studio.issues", DEFINITION_ISSUE_CODES);
    expectKeys("studio.errors", [
      "sign_in_required",
      "contributor_role_required",
      "invalid_input",
      "not_found",
      "not_owner",
      "plugin_disabled",
      "activity_invalid",
      "activity_id_duplicate",
      "field_key_duplicate",
      "template_invalid",
      "template_id_duplicate",
      "template_activity_missing",
      "templates_too_many",
      "definition_invalid",
      "request_pending",
      "version_exists",
      "not_a_draft",
      "definition_too_large",
      "slug_taken",
      "storage_unavailable",
      "unexpected",
    ]);
    expectKeys("studio.outcomes", ["saved"]);
    expectKeys("studio.publish.outcomes", ["published", "requested"]);
    expectKeys("editor.packageIssues", PACKAGE_ISSUE_CODES);
    expectKeys("editor.preview.paused", PLAYABILITY_REASONS);
    expectKeys("editor.preview.errors", [
      "invalid",
      "result_field_forbidden",
      "sign_in_required",
      "not_found",
      "plugin_paused",
      "package_invalid",
    ]);
    expectKeys("editor.errors", [
      "sign_in_required",
      "invalid_input",
      "not_found",
      "not_owner",
      "under_moderation",
      "content_creator_role_required",
      "package_missing",
      "package_invalid",
      "plugin_unavailable",
      "pair_invalid",
      "fix_fields",
      "too_many_assets",
      "publish_first",
      "already_current",
      "already_in_course",
      "own_packages_only",
      "pair_mismatch",
      "unexpected",
    ]);
    expectKeys("editor.outcomes", [
      "saved",
      "lesson_added",
      "lesson_removed",
      "image_added",
      "published",
      "rolled_back",
      "status_archived",
      "status_published",
      "status_draft",
    ]);
    expectKeys("player", PLAYER_STRING_KEYS);
    expectKeys("account.errors", ["already_contributor", "contributor_role_required"]);
  });
});
