import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginDefinition } from "@/modules/plugins/contract";
import { validateDefinition } from "@/modules/plugins/generate";
import { definitionSha256 } from "@/modules/plugins/portable";
import { asAnon, createMigratedDb } from "./harness";

/**
 * The core plugins are seeded as reference data (decision R8) from the files
 * the studio pipeline exported. What the database holds must be exactly what
 * the file says, hash included — otherwise the player would refuse it.
 */
const dir = join(__dirname, "..", "..", "plugins", "core");

describe("core plugins", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".lisanplugin.json"));

  it("exports valid, contract-conforming definitions with matching hashes", () => {
    expect(files.sort()).toEqual(["classic-exercises.lisanplugin.json", "vocab-cards.lisanplugin.json"]);
    for (const file of files) {
      const { sha256, ...definition } = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const validation = validateDefinition(definition, { max_templates: 10, max_definition_bytes: 256 * 1024 });
      expect(validation.ok, file).toBe(true);
      if (validation.ok) expect(definitionSha256(validation.definition)).toBe(sha256);
    }
  });

  it("are seeded as published platform plugins pointing at the exported files, hash included (decision R13)", async () => {
    const db = await createMigratedDb();
    const rows = await asAnon(db, () =>
      db.query<{
        plugin_id: string;
        status: string;
        owner_id: string | null;
        version: string;
        definition_key: string;
        definition_sha256: string;
        draft_key: string | null;
        draft_sha256: string | null;
        current: string;
        version_id: string;
      }>(
        `select p.plugin_id, p.status, p.owner_id, v.version, v.definition_key, v.definition_sha256, p.draft_key, p.draft_sha256,
                p.current_version_id as current, v.id as version_id
           from public.plugins p join public.plugin_versions v on v.plugin_id = p.id order by p.plugin_id`,
      ),
    );
    expect(rows.rows.map((r) => r.plugin_id)).toEqual(["classic-exercises", "vocab-cards"]);
    for (const row of rows.rows) {
      expect(row.status).toBe("published");
      expect(row.owner_id).toBeNull();
      expect(row.current).toBe(row.version_id);
      const file = JSON.parse(readFileSync(join(dir, `${row.plugin_id}.lisanplugin.json`), "utf8"));
      const { sha256, ...definition } = file;
      const stored = PluginDefinition.parse(definition);
      // The row names the file `npm run core:plugins:upload` writes to the store, and carries its hash.
      expect(row.definition_key).toBe(`plugins/core/${row.plugin_id}-${stored.version}.lisanplugin.json`);
      expect(row.version).toBe(stored.version);
      expect(row.definition_sha256).toBe(sha256);
      expect(definitionSha256(stored)).toBe(sha256);
      expect(row.draft_key).toBe(row.definition_key);
      expect(row.draft_sha256).toBe(sha256);
      // Templates are skeletons: activity references and hints only (decision R8).
      for (const template of stored.templates) {
        for (const item of template.items) expect(Object.keys(item).sort()).toEqual(["activity", "hints"]);
      }
    }
  });

  it("covers the four classic exercise types and self-assessed cards", () => {
    const classic = JSON.parse(readFileSync(join(dir, "classic-exercises.lisanplugin.json"), "utf8"));
    expect(classic.activities.map((a: { scoring: { evaluator: string } }) => a.scoring.evaluator)).toEqual([
      "multiple_choice",
      "fill_blank",
      "matching",
      "word_order",
    ]);
    const cards = JSON.parse(readFileSync(join(dir, "vocab-cards.lisanplugin.json"), "utf8"));
    expect(cards.activities[0].scoring).toEqual({ evaluator: "self_assessment", reveal_fields: ["back", "example"] });
  });
});
