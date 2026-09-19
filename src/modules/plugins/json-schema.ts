import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import { sha256OfJson } from "./hash";

/**
 * JSON Schema 2020-12 validation of package content against a plugin's
 * `content_schema` (ADR 0007). Compiled validators are cached by the schema's
 * hash; a plugin's schema is data, so the cache is bounded.
 */
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false, allowUnionTypes: true });

const MAX_CACHED = 64;
const cache = new Map<string, ValidateFunction>();

export interface SchemaIssue {
  /** JSON pointer into the validated document (`/items/3/fields/prompt`). */
  path: string;
  keyword: string;
  message: string;
}

function toIssues(errors: ErrorObject[] | null | undefined): SchemaIssue[] {
  return (errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    keyword: e.keyword,
    message: e.message ?? e.keyword,
  }));
}

/** True when `schema` is itself a valid JSON Schema 2020-12 document. */
export function isValidJsonSchema(schema: unknown): boolean {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return false;
  try {
    return ajv.validateSchema(schema) === true;
  } catch {
    return false;
  }
}

/** Compiles (or reuses) the validator of a schema; throws when the schema is not compilable. */
export function compileJsonSchema(schema: Record<string, unknown>): (data: unknown) => SchemaIssue[] {
  const key = sha256OfJson(schema);
  let validate = cache.get(key);
  if (!validate) {
    validate = ajv.compile(schema);
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
    cache.set(key, validate);
  }
  return (data: unknown) => (validate(data) ? [] : toIssues(validate.errors));
}
