import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";

const ERRORS = new Set(["other_browser", "link_expired"]);

export default async function ForgotPasswordPage({ params, searchParams }: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const [t, tAuth] = await Promise.all([getTranslations("auth.forgot"), getTranslations("auth")]);
  const error = typeof query.error === "string" && ERRORS.has(query.error) ? query.error : null;

  return (
    <AuthShell title={t("title")} lede={t("lede")}>
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{tAuth(`errors.${error}`)}</Alert> : null}
        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}
