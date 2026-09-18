import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { ResendConfirmationForm } from "@/components/forms/auth-forms";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { maskEmail } from "@/modules/account/forms";
import { readPendingEmail } from "@/server/pending-email";

/** Shown right after sign-up: the account exists and waits for the emailed confirmation link. */
export default async function CheckEmailPage({ params }: PageProps<"/[locale]/sign-up/check-email">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const email = await readPendingEmail();
  if (!email) redirect(`/${locale}/sign-up`);
  const t = await getTranslations("auth.checkEmail");

  return (
    <AuthShell title={t("title")}>
      <div className="flex flex-col gap-5">
        <Alert tone="success">
          <p className="font-semibold">{t("created")}</p>
          <p>
            {t("sentTo")} <span dir="ltr">{maskEmail(email)}</span>
          </p>
        </Alert>
        <ol className="list-decimal space-y-2 ps-5 text-sm text-ink-muted">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
        <ResendConfirmationForm />
        <p className="text-sm text-ink-muted">
          {t("alreadyConfirmed")}{" "}
          <Link href="/sign-in" className="font-semibold text-accent underline-offset-4 hover:underline">
            {t("signInLink")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
