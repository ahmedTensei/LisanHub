import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/account/forms";
import { isUiLocale } from "@/modules/account/ui-locales";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "email_change", "magiclink", "invite"];

/**
 * Landing point of the links Supabase sends by email.
 *
 * Two link shapes are accepted:
 *  - `?token_hash=…&type=…` from the custom templates in supabase/templates
 *    (verified here, so the link works from any device);
 *  - `?code=…` from the default Supabase templates (PKCE: the code can only be
 *    exchanged by the browser that started the flow; an already-confirmed
 *    account simply signs in instead).
 * Supabase reports an invalid or expired link with `error_code`.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/[locale]/auth/confirm">) {
  const { locale: requested } = await ctx.params;
  const locale = isUiLocale(requested) ? requested : "ar";
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"), `/${locale}/account?notice=confirmed`);
  const isRecovery = next.includes("/reset-password");

  if (params.get("error_code")) {
    redirect(`/${locale}/${isRecovery ? "forgot-password" : "sign-in"}?error=link_expired`);
  }

  const supabase = await createSupabaseServerClient();
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");

  if (tokenHash && type && (OTP_TYPES as readonly string[]).includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) redirect(next);
    redirect(`/${locale}/${isRecovery ? "forgot-password" : "sign-in"}?error=link_expired`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    // The address was verified by Supabase before redirecting here; only the
    // session could not be created in this browser.
    redirect(`/${locale}/${isRecovery ? "forgot-password?error=other_browser" : "sign-in?notice=confirmed"}`);
  }

  redirect(`/${locale}/sign-in?error=link_invalid`);
}
