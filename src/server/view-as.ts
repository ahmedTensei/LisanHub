import "server-only";

import { cookies } from "next/headers";
import { isViewAs, type ViewAs } from "@/modules/authorization/roles";

/**
 * "View as" for the Platform Owner: a cookie naming the rank or role to
 * emulate in the application layer. Only getSession() honours it, and only
 * for the real owner, so nobody else can widen or change anything with it.
 */
export const VIEW_AS_COOKIE = "lh_view_as";

export async function readViewAs(): Promise<ViewAs | null> {
  const value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  return isViewAs(value) ? value : null;
}

export async function writeViewAs(value: ViewAs | null): Promise<void> {
  const store = await cookies();
  if (!value) {
    store.delete(VIEW_AS_COOKIE);
    return;
  }
  store.set(VIEW_AS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}
