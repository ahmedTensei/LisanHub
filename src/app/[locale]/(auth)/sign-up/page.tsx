import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/forms/auth-forms";
import { getSession } from "@/server/actor";

export default async function SignUpPage({ params }: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (session.actor.kind === "user") redirect(`/${locale}/account`);
  const t = await getTranslations("auth.signUp");

  return (
    <AuthShell title={t("title")} lede={t("lede")}>
      <SignUpForm />
    </AuthShell>
  );
}
