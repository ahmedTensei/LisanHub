import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorage } from "@/server/storage";

/** Stable URL of a profile picture, derived from its key by the configured storage provider. */
export async function avatarUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  const storage = await getStorage();
  return storage.publicUrl({ store: "public", key });
}

export interface OwnProfile {
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  avatarKey: string | null;
  uiLocale: string;
  visibility: "public" | "restricted";
  primaryRole: "student" | "content_creator" | "contributor";
  isFoundingMember: boolean;
}

/** The signed-in user's own profile (row level security only ever returns their row). */
export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "username, display_name, bio, location, avatar_key, ui_locale, visibility, primary_role, is_founding_member",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`profile: ${error.message}`);
  if (!data) return null;
  return {
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    location: data.location,
    avatarKey: data.avatar_key,
    uiLocale: data.ui_locale,
    visibility: data.visibility,
    primaryRole: data.primary_role,
    isFoundingMember: data.is_founding_member,
  };
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  primaryRole: "student" | "content_creator" | "contributor";
  isFoundingMember: boolean;
  memberSince: string;
}

/** A member's public page; restricted profiles are invisible here to everyone but themselves and moderation. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, location, avatar_key, primary_role, is_founding_member, created_at")
    .ilike("username", username.replace(/[%_]/g, ""))
    .maybeSingle();
  if (error) throw new Error(`profile: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    location: data.location,
    avatarUrl: await avatarUrl(data.avatar_key),
    primaryRole: data.primary_role,
    isFoundingMember: data.is_founding_member,
    memberSince: data.created_at,
  };
}

export interface LanguagePairView {
  id: string;
  native: { code: string; name: string };
  target: { code: string; name: string };
  dialect: string | null;
  goal: string | null;
}

/** The signed-in user's language pairs with the English names of both languages. */
export async function listLanguagePairs(userId: string): Promise<LanguagePairView[]> {
  const supabase = await createSupabaseServerClient();
  const pairs = await supabase
    .from("language_pairs")
    .select("id, native_lang, target_lang, dialect_tag, goal, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (pairs.error) throw new Error(`language pairs: ${pairs.error.message}`);
  if (pairs.data.length === 0) return [];

  const codes = [...new Set(pairs.data.flatMap((p) => [p.native_lang, p.target_lang]))];
  const languages = await supabase.from("languages").select("code, name_en").in("code", codes);
  if (languages.error) throw new Error(`languages: ${languages.error.message}`);
  const names = new Map(languages.data.map((l) => [l.code, l.name_en]));

  return pairs.data.map((p) => ({
    id: p.id,
    native: { code: p.native_lang, name: names.get(p.native_lang) ?? p.native_lang },
    target: { code: p.target_lang, name: names.get(p.target_lang) ?? p.target_lang },
    dialect: p.dialect_tag,
    goal: p.goal,
  }));
}

/** Support contact shown to members (platform setting; empty until decided). */
export async function getSupportEmail(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "support.email").maybeSingle();
  const value = data?.value;
  return typeof value === "string" && value.includes("@") ? value : null;
}

export interface OwnSupportRequest {
  id: string;
  kind: "revert_to_student" | "other";
  status: "open" | "in_review" | "resolved" | "rejected";
  message: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

/** The member's own support requests, newest first (row level security scopes them). */
export async function listOwnSupportRequests(userId: string): Promise<OwnSupportRequest[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("support_requests")
    .select("id, kind, status, message, resolution_note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`support requests: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    message: r.message,
    resolutionNote: r.resolution_note,
    createdAt: r.created_at,
  }));
}

/** Number of language pairs, for the dashboard. */
export async function countLanguagePairs(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("language_pairs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`language pairs: ${error.message}`);
  return count ?? 0;
}
