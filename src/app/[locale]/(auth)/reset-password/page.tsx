import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { getSession } from "@/server/actor";

/** Reached from the recovery email: the link signs the user in, then they choose a new password. */
export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tForgot, session] = await Promise.all([
    getTranslations("auth.reset"),
    getTranslations("auth.forgot"),
    getSession(),
  ]);

  return (
    <AuthShell title={t("title")}>
      {session.actor.kind === "user" ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert tone="error">{t("needSession")}</Alert>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            {tForgot("title")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
