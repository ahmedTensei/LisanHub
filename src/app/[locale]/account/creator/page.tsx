import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BecomeCreatorForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/actor";
import { getOwnProfile } from "@/server/queries/account";

const COMMITMENTS = ["publish", "attribution", "rules", "review", "noReturn"] as const;

/**
 * The one place where a Student becomes a Content Creator. Reached only from the
 * advanced section of the account; one explicit confirmation; no way back except
 * through support (decision R4).
 */
export default async function BecomeCreatorPage({ params }: PageProps<"/[locale]/account/creator">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/creator`);
  const [t, profile] = await Promise.all([getTranslations("account.creator"), getOwnProfile(session.actor.userId)]);
  if (!profile) throw new Error("profile missing");
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <Card id="creator" title={t("title")}>
      {profile.primaryRole !== "student" ? (
        <>
          <Alert tone="info">{t("alreadyCreator")}</Alert>
          <p className="text-sm text-ink-muted">{t("returnViaSupport")}</p>
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
          <BecomeCreatorForm />
          <Link href="/account/advanced" className={`text-sm ${linkClass}`}>
            {t("backToAdvanced")}
          </Link>
        </>
      )}
    </Card>
  );
}
