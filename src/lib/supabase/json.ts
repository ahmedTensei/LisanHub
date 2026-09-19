import type { Json } from "./database.types";

/** Narrows a plain, JSON-serialisable value to the `Json` type of the generated schema (jsonb columns and rpc arguments). */
export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
