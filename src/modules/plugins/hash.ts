import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Deterministic JSON: object keys sorted, no whitespace, so the same value
 * hashes identically in the server, in the studio and in the sandboxed player.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function sha256OfText(text: string): string {
  return sha256Hex(new TextEncoder().encode(text));
}

/** The pinned hash of a definition or any JSON document: sha256 of its canonical form. */
export function sha256OfJson(value: unknown): string {
  return sha256OfText(canonicalJson(value));
}
