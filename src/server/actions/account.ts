"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issuesToFieldErrors, keepValues, safeNextPath, type FormState } from "@/modules/account/forms";
import { LanguagePairInput, PreferencesInput, ProfileUpdateInput, validateAvatar } from "@/modules/account/schemas";
import { isViewAs } from "@/modules/authorization/roles";
import { buildObjectKey } from "@/modules/storage/keys";
import { getStorage } from "@/server/storage";
import { writeViewAs } from "@/server/view-as";
import { isUiLocale } from "@/modules/account/ui-locales";
import { can } from "@/modules/authorization/capabilities";
import { canBecomeContentCreator, canBecomeContributor } from "@/modules/authorization/policies";
import { getSession } from "@/server/actor";

/**
 * Profile, role and language-pair actions. Authorization is decided by
 * capabilities and policies (src/modules/authorization); row level security in
 * the database enforces the same ownership rules for direct callers.
 */

function localeOf(value: string): string {
  return isUiLocale(value) ? value : "ar";
}

export async function updateProfile(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };
  if (!can(actor, "profile.edit_own")) return { status: "error", error: "not_allowed" };

  const values = keepValues(formData, ["username", "displayName", "bio", "location"]);
  const parsed = ProfileUpdateInput.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
    location: formData.get("location"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName,
      bio: parsed.data.bio,
      location: parsed.data.location,
    })
    .eq("id", actor.userId);
  if (error?.code === "23505") return { status: "error", fieldErrors: { username: "username_taken" }, values };
  if (error) return { status: "error", error: "unexpected", values };

  revalidatePath(`/${uiLocale}/account`);
  redirect(`/${uiLocale}/account?notice=saved`);
}

/**
 * Profile picture: validated here (type, size), stored through the storage
 * provider under the member's own folder, referenced by its relative key.
 */
export async function uploadAvatar(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor, avatarKey } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };
  if (!can(actor, "profile.edit_own")) return { status: "error", error: "not_allowed" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { status: "error", fieldErrors: { avatar: "required" } };
  const invalid = validateAvatar(file);
  if (invalid) return { status: "error", fieldErrors: { avatar: invalid } };

  const key = buildObjectKey({ area: "avatars", ownerId: actor.userId, contentType: file.type });
  const storage = await getStorage();
  try {
    await storage.upload({ store: "public", key }, file, { contentType: file.type, cacheControlSeconds: 31536000 });
  } catch {
    return { status: "error", error: "upload_failed" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ avatar_key: key }).eq("id", actor.userId);
  if (error) {
    await storage.remove([{ store: "public", key }]).catch(() => undefined);
    return { status: "error", error: "unexpected" };
  }
  if (avatarKey) await storage.remove([{ store: "public", key: avatarKey }]).catch(() => undefined);

  revalidatePath(`/${uiLocale}`, "layout");
  return { status: "ok", outcome: "avatar_saved" };
}

export async function removeAvatar(locale: string): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor, avatarKey } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };
  if (!avatarKey) return { status: "ok", outcome: "avatar_removed" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ avatar_key: null }).eq("id", actor.userId);
  if (error) return { status: "error", error: "unexpected" };
  const storage = await getStorage();
  await storage.remove([{ store: "public", key: avatarKey }]).catch(() => undefined);

  revalidatePath(`/${uiLocale}`, "layout");
  return { status: "ok", outcome: "avatar_removed" };
}

/** Platform Owner only: view the platform as a narrower rank or role, or return to the real one. */
export async function setViewAs(formData: FormData): Promise<void> {
  const { isOwner } = await getSession();
  const pathname = safeNextPath(formData.get("pathname"), "/");
  if (!isOwner) return;
  const value = formData.get("viewAs");
  await writeViewAs(isViewAs(value) ? value : null);
  redirect(pathname);
}

export async function updatePreferences(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };
  if (!can(actor, "profile.edit_own")) return { status: "error", error: "not_allowed" };

  const parsed = PreferencesInput.safeParse({
    uiLocale: formData.get("uiLocale"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ui_locale: parsed.data.uiLocale, visibility: parsed.data.visibility })
    .eq("id", actor.userId);
  if (error) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/account/preferences`);
  // The interface follows the saved preference immediately.
  redirect(`/${parsed.data.uiLocale}/account/preferences?notice=saved`);
}

/**
 * One deliberate confirmation (Ahmed, 2026-09-17): the member must acknowledge
 * the responsibilities; there is no self-service way back (support only).
 */
export async function becomeContentCreator(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const decision = canBecomeContentCreator(actor);
  if (!decision.allowed) return { status: "error", error: decision.reason };
  if (formData.get("acknowledge") !== "on") return { status: "error", error: "acknowledge_required" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("become_content_creator");
  if (error) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/account`);
  redirect(`/${uiLocale}/account?notice=content_creator`);
}

/** Student -> Contributor (decision R10): the mirror of becomeContentCreator, one path per member. */
export async function becomeContributor(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  const decision = canBecomeContributor(actor);
  if (!decision.allowed) return { status: "error", error: decision.reason };
  if (formData.get("acknowledge") !== "on") return { status: "error", error: "acknowledge_required" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("become_contributor");
  if (error) return { status: "error", error: "unexpected" };

  revalidatePath(`/${uiLocale}/account`);
  redirect(`/${uiLocale}/studio?notice=contributor`);
}

export async function addLanguagePair(locale: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user") return { status: "error", error: "sign_in_required" };
  if (!can(actor, "language_pairs.manage_own")) return { status: "error", error: "not_allowed" };

  const values = keepValues(formData, ["dialect", "goal"]);
  const parsed = LanguagePairInput.safeParse({
    native: formData.get("native"),
    target: formData.get("target"),
    dialect: formData.get("dialect"),
    goal: formData.get("goal"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: issuesToFieldErrors(parsed.error.issues), values };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("language_pairs").insert({
    user_id: actor.userId,
    native_lang: parsed.data.native,
    target_lang: parsed.data.target,
    dialect_tag: parsed.data.dialect ?? null,
    goal: parsed.data.goal ?? null,
  });
  if (error) {
    switch (error.code) {
      case "23505":
        return { status: "error", error: "pair_exists", values };
      case "23503":
        return { status: "error", fieldErrors: { target: "language_invalid" }, values };
      case "23514":
        return { status: "error", fieldErrors: { target: "same_language" }, values };
      default:
        return { status: "error", error: "unexpected", values };
    }
  }

  revalidatePath(`/${uiLocale}/account/languages`);
  return { status: "ok", outcome: "pair_added" };
}

export async function removeLanguagePair(locale: string, formData: FormData): Promise<void> {
  const uiLocale = localeOf(locale);
  const { actor } = await getSession();
  if (actor.kind !== "user" || !can(actor, "language_pairs.manage_own")) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return;

  const supabase = await createSupabaseServerClient();
  // The user id filter is defence in depth: row level security already scopes the delete.
  await supabase.from("language_pairs").delete().eq("id", id).eq("user_id", actor.userId);
  revalidatePath(`/${uiLocale}/account/languages`);
}

/**
 * Interface language chosen from the header menu. Signed-in users keep it in
 * their profile so every device follows; the page reloads in the new language.
 */
export async function changeUiLocale(formData: FormData): Promise<void> {
  const target = formData.get("locale");
  const pathname = safeNextPath(formData.get("pathname"), "/");
  if (!isUiLocale(target)) return;

  const { actor } = await getSession();
  if (actor.kind === "user" && can(actor, "profile.edit_own")) {
    const supabase = await createSupabaseServerClient();
    await supabase.from("profiles").update({ ui_locale: target }).eq("id", actor.userId);
  }
  redirect(`/${target}${pathname === "/" ? "" : pathname}`);
}
