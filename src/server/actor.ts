import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { can, type Capability } from "@/modules/authorization/capabilities";
import { emulate, guest, toActor, type Actor, type ViewAs } from "@/modules/authorization/roles";
import { readViewAs } from "./view-as";

export interface Session {
  /** The actor every policy sees; for the owner in "view as" mode, the narrowed one. */
  actor: Actor;
  /** Email, username, display name and picture of the signed-in account, for display only. */
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarKey: string | null;
  /** True for the real Platform Owner, whatever is being emulated. */
  isOwner: boolean;
  /** Rank or role the owner is currently viewing the platform as. */
  viewingAs: ViewAs | null;
}

const anonymous: Session = {
  actor: guest,
  email: null,
  username: null,
  displayName: null,
  avatarKey: null,
  isOwner: false,
  viewingAs: null,
};

/**
 * Resolves the caller of the current request into an Actor: verified JWT claims
 * (session) + stored primary role and administrative rank. Cached per request.
 * Every server action and protected page starts here; nothing trusts ids sent
 * by the browser. The Platform Owner may narrow their own actor with "view as"
 * (application layer only; row level security still sees the real account).
 */
export const getSession = cache(async (): Promise<Session> => {
  if (!isSupabaseConfigured()) return anonymous;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return anonymous;

  const [profile, rank] = await Promise.all([
    supabase.from("profiles").select("primary_role, username, display_name, avatar_key").eq("id", userId).maybeSingle(),
    supabase.from("admin_ranks").select("rank").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw new Error(`actor: ${profile.error.message}`);
  if (!profile.data) throw new Error("actor: profile missing for a signed-in user");

  const real = toActor({ userId, primaryRole: profile.data.primary_role, adminRank: rank.data?.rank ?? null });
  const isOwner = real.kind === "user" && real.adminRank === "platform_owner";
  const viewingAs = isOwner ? await readViewAs() : null;

  return {
    actor: emulate(real, viewingAs),
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    username: profile.data.username,
    displayName: profile.data.display_name,
    avatarKey: profile.data.avatar_key,
    isOwner,
    viewingAs,
  };
});

export async function getActor(): Promise<Actor> {
  return (await getSession()).actor;
}

/** For pages that need an account: sends guests to sign-in and brings them back afterwards. */
export async function requireUser(locale: string, nextPath: string) {
  const session = await getSession();
  if (session.actor.kind !== "user") {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return { ...session, actor: session.actor };
}

/** For staff pages: guests go to sign-in, signed-in members without the capability get a 404. */
export async function requireCapability(locale: string, capability: Capability, nextPath: string) {
  const session = await requireUser(locale, nextPath);
  if (!can(session.actor, capability)) notFound();
  return session;
}
