import type { FormState } from "@/modules/account/forms";
import type { FormErrorCode } from "@/modules/account/schemas";

export function fieldCode(state: FormState, field: string): FormErrorCode | undefined {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}

export function formError(state: FormState): string | undefined {
  return state.status === "error" ? state.error : undefined;
}

/** Values the action sent back so the form can show what was typed (React resets forms after actions). */
export function formValues(state: FormState): Record<string, string> {
  return state.status === "error" ? (state.values ?? {}) : {};
}
