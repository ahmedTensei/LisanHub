import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChangeEmailForm, ChangePasswordForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/actor";

export default async function SecurityPage({ params, searchParams }: PageProps<"/[locale]/account/security">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/security`);
  const [t, query] = await Promise.all([getTranslations("account"), searchParams]);
  const notice = query.notice === "password_updated" ? "password_updated" : null;

  return (
    <>
      {notice ? <Alert tone="success">{t(`notices.${notice}`)}</Alert> : null}
      <Card id="password" title={t("security.passwordTitle")}>
        <ChangePasswordForm />
      </Card>
      <Card id="email" title={t("security.emailTitle")}>
        <ChangeEmailForm currentEmail={session.email} />
      </Card>
      <Card id="sessions" title={t("security.sessionsTitle")}>
        <p className="text-sm text-ink-muted">{t("security.sessionsBody")}</p>
      </Card>
    </>
  );
}
