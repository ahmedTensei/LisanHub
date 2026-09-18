import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { localeDirection, routing } from "./routing";

function keys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("interface messages", () => {
  const catalogs = { ar, fr, en } as const;

  it("has a catalog for every routed locale", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...routing.locales].sort());
  });

  it("keeps the same keys in every language", () => {
    const reference = keys(ar).sort();
    expect(keys(fr).sort()).toEqual(reference);
    expect(keys(en).sort()).toEqual(reference);
  });

  it("never leaves a message empty", () => {
    for (const catalog of Object.values(catalogs)) {
      for (const key of keys(catalog)) {
        const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalog);
        expect(String(value).trim(), key).not.toBe("");
      }
    }
  });
});

describe("text direction", () => {
  it("renders Arabic right-to-left and French and English left-to-right", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("fr")).toBe("ltr");
    expect(localeDirection("en")).toBe("ltr");
  });
});
