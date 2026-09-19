import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BecomeContributorForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/actor";
import { getOwnProfile } from "@/server/queries/account";

const COMMITMENTS = ["build", "review", "sandbox", "attribution", "onePath", "noReturn"] as const;

/**
 * The one place where a Student becomes a Contributor (decision R10): reached
 * from the advanced section of the account, one explicit confirmation, no way
 * back except through support. A Content Creator cannot come here.
 */
export default async function BecomeContributorPage({ params }: PageProps<"/[locale]/account/contributor">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/contributor`);
  const [t, profile] = await Promise.all([getTranslations("account.contributor"), getOwnProfile(session.actor.userId)]);
  if (!profile) throw new Error("profile missing");
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <Card id="contributor" title={t("title")}>
      {profile.primaryRole === "contributor" ? (
        <>
          <Alert tone="info">{t("alreadyContributor")}</Alert>
          <Link href="/studio" className={`text-sm ${linkClass}`}>
            {t("openStudio")}
          </Link>
        </>
      ) : profile.primaryRole !== "student" ? (
        <>
          <Alert tone="info">{t("onePathOnly")}</Alert>
          <Link href="/account/advanced" className={`text-sm ${linkClass}`}>
            {t("backToAdvanced")}
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted">{t("lede")}</p>
          <ul className="flex flex-col gap-3 text-sm">
            {COMMITMENTS.map((key) => (
              <li key={key} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{t(`commitments.${key}`)}</span>
              </li>
            ))}
          </ul>
          <BecomeContributorForm />
          <Link href="/account/advanced" className={`text-sm ${linkClass}`}>
            {t("backToAdvanced")}
          </Link>
        </>
      )}
    </Card>
  );
}
