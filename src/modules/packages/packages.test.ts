import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { PluginActivity, PluginDefinition } from "@/modules/plugins/contract";
import { definitionFromDraft } from "@/modules/plugins/generate";
import { sha256Hex } from "@/modules/plugins/hash";
import { buildPackage, contentSha256, type BuildInput } from "./build";
import { moveItem, removeItem, updateItem, withStableIds } from "./items";
import type { PackageManifest } from "./manifest";
import { sniffImageType } from "./sniff";
import { validatePackage, type PackageIssueCode } from "./validate";
import { listZipEntries, writeZip } from "./zip";

const t = (text: string) => ({ ar: text, fr: text, en: text });
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
const JPEG_HEADER = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

const activities: PluginActivity[] = [
  {
    id: "choose",
    name: t("choose"),
    skill: "reading",
    fields: [
      { key: "prompt", type: "short_text", label: t("prompt"), required: true, max_length: 200 },
      { key: "picture", type: "image", label: t("picture"), required: false },
      { key: "answer", type: "single_choice", label: t("answer"), required: true, min_options: 2, max_options: 6 },
    ],
    graded_field: "answer",
    scoring: { evaluator: "multiple_choice" },
  },
];

function plugin(): PluginDefinition {
  const result = definitionFromDraft(
    {
      plugin_id: "test-choices",
      name: t("Choices"),
      description: t("Test"),
      activities,
      assets_allowed: ["image"],
    },
    { max_templates: 5, max_definition_bytes: 200_000 },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.definition;
}

const limits = { max_bytes: 50_000, max_items: 10, max_assets: 3, max_asset_bytes: 2_000 };
const options = {
  limits,
  resolvePlugin: (id: string, schema: number) =>
    id !== "test-choices" ? null : schema !== 1 ? ("unknown_schema_version" as const) : plugin(),
};

const item = (id: string, asset?: string) => ({
  item_id: id,
  activity: "choose",
  fields: {
    prompt: "Bonjour means…",
    ...(asset ? { picture: { asset, alt: "A greeting" } } : {}),
    answer: {
      options: [
        { id: "a", text: "صباح الخير" },
        { id: "b", text: "شكرًا" },
      ],
      correct: "a",
    },
  },
});

const manifest: BuildInput["manifest"] = {
  format: "lisanhub.package/1",
  package_id: "2d1c8b1e-3f36-4c58-9c4d-1a2b3c4d5e6f",
  version: 0,
  plugin: { id: "test-choices", version: "1.0.0", schema_version: 1 },
  language_pair: { source: "ara", target: "fra" },
  cefr: "A1",
  cefr_sublevel: null,
  skills: ["reading"],
  tags: ["greetings"],
  title: "Greetings",
  summary: "",
  license: null,
  author: { user_id: "6f1d1c2e-1234-4abc-9def-1234567890ab", username: "tester", display_name: "Tester" },
  provenance: null,
  created_at: "2026-09-18T10:00:00.000Z",
};

function build(overrides: Partial<BuildInput> = {}) {
  return buildPackage({
    manifest,
    content: { items: [item("item-0001", "assets/greeting.png"), item("item-0002")] },
    assets: { "assets/greeting.png": { bytes: PNG, type: "image/png" } },
    ...overrides,
  });
}

/** Rebuilds a package from raw entries so tests can plant exactly one defect. */
function tamper(edit: (entries: Record<string, Uint8Array>, m: PackageManifest) => void, fix = true): Uint8Array {
  const built = build();
  const entries: Record<string, Uint8Array> = {
    "manifest.json": new TextEncoder().encode(JSON.stringify(built.manifest)),
    "content.json": new TextEncoder().encode(
      JSON.stringify({ items: [item("item-0001", "assets/greeting.png"), item("item-0002")] }),
    ),
    "assets/greeting.png": PNG,
  };
  const m = structuredClone(built.manifest);
  edit(entries, m);
  if (fix) entries["manifest.json"] = new TextEncoder().encode(JSON.stringify(m));
  return writeZip(entries);
}

function codesOf(bytes: Uint8Array): PackageIssueCode[] {
  const result = validatePackage(bytes, options);
  return result.ok ? [] : result.issues.map((i) => i.code);
}

describe("package build and validation", () => {
  it("builds a deterministic package the validator accepts unchanged", () => {
    const a = build();
    const b = build();
    expect(sha256Hex(a.bytes)).toBe(sha256Hex(b.bytes));
    expect(a.manifest.items_count).toBe(2);
    expect(a.manifest.assets).toEqual([
      { path: "assets/greeting.png", type: "image/png", bytes: PNG.length, sha256: sha256Hex(PNG) },
    ]);
    const result = validatePackage(a.bytes, options);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package.fileSha256).toBe(a.fileSha256);
      expect(result.package.content.items).toHaveLength(2);
      expect(result.package.assets.get("assets/greeting.png")?.type).toBe("image/png");
    }
    expect(listZipEntries(a.bytes).map((e) => e.name)).toEqual([
      "assets/greeting.png",
      "content.json",
      "manifest.json",
    ]);
  });

  it("rejects a package over the size limit and too many entries", () => {
    const built = build();
    expect(codesOf(new Uint8Array(limits.max_bytes + 1))).toEqual(["too_large"]);
    const result = validatePackage(built.bytes, { ...options, limits: { ...limits, max_assets: 0 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].code).toBe("too_many_entries");
  });

  it("rejects too many items, too many assets and an asset over its size", () => {
    const many = build({
      content: { items: Array.from({ length: 11 }, (_, i) => item(`item-${1000 + i}`)) },
      assets: {},
    });
    expect(codesOf(many.bytes)).toEqual(["too_many_items"]);

    const big = { bytes: new Uint8Array(3_000), type: "image/png" as const };
    big.bytes.set(PNG);
    const bigPackage = build({ assets: { "assets/greeting.png": big } });
    expect(codesOf(bigPackage.bytes)).toEqual(["asset_too_large"]);

    const threeAssets = build({
      assets: {
        "assets/a.png": { bytes: PNG, type: "image/png" },
        "assets/b.png": { bytes: PNG, type: "image/png" },
        "assets/c.png": { bytes: PNG, type: "image/png" },
        "assets/greeting.png": { bytes: PNG, type: "image/png" },
      },
    });
    expect(codesOf(threeAssets.bytes)).toEqual(["too_many_entries"]);
  });

  it("rejects entries outside the package layout: traversal, absolute paths, nested folders, symlinks", () => {
    const bad = (name: string) => tamper((entries) => (entries[name] = PNG));
    expect(codesOf(bad("../escape.png"))).toEqual(["bad_entry_path"]);
    expect(codesOf(bad("assets/../manifest2.json"))).toEqual(["bad_entry_path"]);
    expect(codesOf(bad("/etc/passwd"))).toEqual(["bad_entry_path"]);
    expect(codesOf(bad("assets/sub/deep.png"))).toEqual(["bad_entry_path"]);
    expect(codesOf(bad("assets/script.js"))).toEqual(["bad_entry_path"]);
    expect(codesOf(bad("C:\\\\windows\\\\x.png"))).toEqual(["bad_entry_path"]);

    const built = build();
    const withLink = zipSync({
      "manifest.json": new TextEncoder().encode(JSON.stringify(built.manifest)),
      "content.json": new TextEncoder().encode(
        JSON.stringify({ items: [item("item-0001", "assets/greeting.png"), item("item-0002")] }),
      ),
      "assets/greeting.png": PNG,
      "assets/link.png": [new TextEncoder().encode("../../etc/passwd"), { os: 3, attrs: 0xa1ed0000 }],
    });
    expect(listZipEntries(withLink).find((e) => e.name === "assets/link.png")?.isSymlink).toBe(true);
    expect(codesOf(withLink)).toEqual(["symlink_entry"]);
  });

  it("rejects an asset whose bytes are not the declared type, and a tampered asset", () => {
    const disguised = tamper((entries) => (entries["assets/greeting.png"] = JPEG_HEADER), true);
    expect(codesOf(disguised)).toEqual(["asset_type_mismatch"]);

    const swapped = tamper((entries) => {
      const other = new Uint8Array(PNG);
      other[PNG.length - 1] ^= 0xff;
      entries["assets/greeting.png"] = other;
    });
    expect(codesOf(swapped)).toEqual(["asset_sha256_mismatch"]);

    const undeclared = tamper((entries) => (entries["assets/extra.png"] = PNG));
    expect(codesOf(undeclared)).toEqual(["asset_undeclared"]);
    const missing = tamper((entries) => delete entries["assets/greeting.png"]);
    expect(codesOf(missing)).toEqual(["asset_missing"]);
  });

  it("rejects content that does not match the plugin schema or references a missing asset", () => {
    const wrongShape = build({
      content: {
        items: [
          { item_id: "item-0001", activity: "choose", fields: { prompt: "x", answer: { options: [], correct: "a" } } },
        ],
      },
      assets: {},
    });
    const result = validatePackage(wrongShape.bytes, options);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues[0]).toMatchObject({ code: "schema_mismatch", path: expect.stringContaining("/items/0") });

    const unknownActivity = build({ content: { items: [{ ...item("item-0001"), activity: "ghost" }] }, assets: {} });
    expect(codesOf(unknownActivity.bytes)).toContain("schema_mismatch");

    const danglingRef = build({ content: { items: [item("item-0001", "assets/nope.png")] }, assets: {} });
    expect(codesOf(danglingRef.bytes)).toEqual(["asset_reference_missing"]);
  });

  it("rejects an unknown plugin or schema version, duplicate item ids and a wrong content hash", () => {
    const foreign = build({ manifest: { ...manifest, plugin: { ...manifest.plugin, id: "other-plugin" } } });
    expect(codesOf(foreign.bytes)).toEqual(["unknown_plugin"]);
    const futureSchema = build({ manifest: { ...manifest, plugin: { ...manifest.plugin, schema_version: 2 } } });
    expect(codesOf(futureSchema.bytes)).toEqual(["unknown_schema_version"]);

    const duplicate = build({ content: { items: [item("item-0001"), item("item-0001")] }, assets: {} });
    expect(codesOf(duplicate.bytes)).toEqual(["duplicate_item_id"]);

    const edited = tamper((entries) => {
      entries["content.json"] = new TextEncoder().encode(
        JSON.stringify({ items: [item("item-0001", "assets/greeting.png"), item("item-0009")] }),
      );
    });
    expect(codesOf(edited)).toEqual(["sha256_mismatch"]);
    const wrongCount = tamper((_, m) => (m.items_count = 5));
    expect(codesOf(wrongCount)).toEqual(["items_count_mismatch"]);
  });

  it("rejects things that are not packages at all", () => {
    expect(codesOf(new TextEncoder().encode("hello"))).toEqual(["not_a_package"]);
    expect(codesOf(writeZip({ "content.json": new Uint8Array([123, 125]) }))).toEqual(["missing_manifest"]);
    expect(codesOf(writeZip({ "manifest.json": new Uint8Array([123, 125]) }))).toEqual(["missing_content"]);
    expect(
      codesOf(
        writeZip({ "manifest.json": new TextEncoder().encode("{}"), "content.json": new TextEncoder().encode("{}") }),
      ),
    ).toEqual(["manifest_invalid"]);
  });

  it("sniffs image types from bytes, not names", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG_HEADER)).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='x'></svg>"))).toBeNull();
    expect(sniffImageType(new Uint8Array(3))).toBeNull();
  });

  it("hashes content independently of the zip bytes", () => {
    const a = build();
    expect(
      contentSha256(
        a.manifest ? { items: [item("item-0001", "assets/greeting.png"), item("item-0002")] } : { items: [] },
        a.manifest.assets,
      ),
    ).toBe(a.manifest.sha256);
  });
});

describe("item identity", () => {
  const items = withStableIds([
    { item_id: "item-0001", activity: "choose", fields: { prompt: "a" } },
    { activity: "choose", fields: { prompt: "b" } },
  ]);

  it("keeps existing ids, assigns fresh ones only where missing, and never renumbers on edit", () => {
    expect(items[0].item_id).toBe("item-0001");
    expect(items[1].item_id).toMatch(/^[0-9a-f-]{36}$/);
    const edited = updateItem(items, "item-0001", { fields: { prompt: "changed" } });
    expect(edited.map((i) => i.item_id)).toEqual(items.map((i) => i.item_id));
    const moved = moveItem(edited, "item-0001", 1);
    expect(moved.map((i) => i.item_id)).toEqual([items[1].item_id, "item-0001"]);
    expect(moveItem(moved, "item-0001", 1).map((i) => i.item_id)).toEqual([items[1].item_id, "item-0001"]);
    expect(removeItem(moved, items[1].item_id).map((i) => i.item_id)).toEqual(["item-0001"]);
    expect(withStableIds(moved).map((i) => i.item_id)).toEqual(moved.map((i) => i.item_id));
  });

  it("repairs duplicate ids without touching the first occurrence", () => {
    const repaired = withStableIds([
      { item_id: "item-0001", activity: "choose", fields: {} },
      { item_id: "item-0001", activity: "choose", fields: {} },
    ]);
    expect(repaired[0].item_id).toBe("item-0001");
    expect(repaired[1].item_id).not.toBe("item-0001");
  });
});
