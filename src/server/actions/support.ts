"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issuesToFieldErrors, keepValues, type FormState } from "@/modules/account/forms";
import { isUiLocale } from "@/modules/account/ui-locales";
import { SupportRequestInput } from "@/modules/support/requests";
import { getSession } from "@/server/actor";

function localeOf(value: string): string {
  return isUiLocale(value) ? value : "ar";
}

/** A member writes to support from the platform (for example to return to a Student account). */
export async function createSupportRequest(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };

  const values = keepValues(formData, ["message"]);
  const parsed = SupportRequestInput.safeParse({ kind: formData.get("kind"), message: formData.get("message") });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };
  if (parsed.data.kind === "revert_to_student" && actor.primaryRole !== "content_creator") {
    return { status: "error", error: "not_allowed", values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("support_requests").insert({
    user_id: actor.userId,
    kind: parsed.data.kind,
    message: parsed.data.message ?? null,
  });
  if (error?.code === "23505") return { status: "error", error: "request_pending", values };
  if (error) return { status: "error", error: "unexpected", values };

  revalidatePath(`/${uiLocale}/account/advanced`);
  return { status: "ok", outcome: "request_sent" };
}
