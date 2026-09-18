import "server-only";

import { cookies } from "next/headers";

/** Address awaiting confirmation, kept briefly so the check-email page can name it and resend the link. */
export const PENDING_EMAIL_COOKIE = "lh_pending_email";
const PENDING_EMAIL_MAX_AGE = 60 * 30;

export async function rememberPendingEmail(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PENDING_EMAIL_MAX_AGE,
    path: "/",
  });
}

export async function readPendingEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_EMAIL_COOKIE)?.value ?? null;
}
