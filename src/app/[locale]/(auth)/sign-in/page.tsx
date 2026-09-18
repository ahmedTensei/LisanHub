import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { safeNextPath } from "@/modules/account/forms";
import { getSession } from "@/server/actor";

const NOTICES = new Set(["confirmed"]);
const ERRORS = new Set(["link_expired", "link_invalid"]);

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const next = typeof query.next === "string" ? safeNextPath(query.next, "") : "";

  const session = await getSession();
  if (session.actor.kind === "user") redirect(next || `/${locale}/account`);

  const [t, tAuth] = await Promise.all([getTranslations("auth.signIn"), getTranslations("auth")]);
  const notice = typeof query.notice === "string" && NOTICES.has(query.notice) ? query.notice : null;
  const error = typeof query.error === "string" && ERRORS.has(query.error) ? query.error : null;

  return (
    <AuthShell title={t("title")}>
      <div className="flex flex-col gap-4">
        {next ? <Alert>{t("requiredNotice")}</Alert> : null}
        {notice ? <Alert tone="success">{tAuth(`notices.${notice}`)}</Alert> : null}
        {error ? <Alert tone="error">{tAuth(`errors.${error}`)}</Alert> : null}
        <SignInForm next={next || undefined} />
      </div>
    </AuthShell>
  );
}
