import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SupportRequestForm } from "@/components/forms/account-forms";
import { Card } from "@/components/ui/card";
import { isPending } from "@/modules/support/requests";
import { requireUser } from "@/server/actor";
import { getOwnProfile, listOwnSupportRequests } from "@/server/queries/account";

const SOON = [
  { key: "export", stage: "S6" },
  { key: "delete", stage: "S6" },
] as const;

/**
 * Account type and support: deliberately the last section (decision R4). The
 * switch to Content Creator and the way back both start here.
 */
export default async function AdvancedPage({ params }: PageProps<"/[locale]/account/advanced">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/advanced`);
  const [t, tNav, format, profile, requests] = await Promise.all([
    getTranslations("account"),
    getTranslations("nav"),
    getFormatter(),
    getOwnProfile(session.actor.userId),
    listOwnSupportRequests(session.actor.userId),
  ]);
  if (!profile) throw new Error("profile missing");
  const pendingRevert = requests.some((r) => r.kind === "revert_to_student" && isPending(r.status));
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <>
      <Card id="account-type" title={t("advanced.accountType")}>
        {profile.primaryRole === "student" ? (
          <>
            <p className="text-sm text-ink-muted">{t("advanced.studentBody")}</p>
            <Link href="/account/creator" className={`text-sm ${linkClass}`}>
              {t("advanced.becomeLink")}
            </Link>
            <p className="text-sm text-ink-muted">{t("advanced.contributorIntro")}</p>
            <Link href="/account/contributor" className={`text-sm ${linkClass}`}>
              {t("advanced.becomeContributorLink")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              {profile.primaryRole === "contributor" ? t("advanced.contributorBody") : t("advanced.creatorBody")}
            </p>
            {pendingRevert ? (
              <p className="text-sm font-semibold text-saffron">{t("support.pendingRevert")}</p>
            ) : (
              <SupportRequestForm kind="revert_to_student" />
            )}
          </>
        )}
      </Card>

      <Card id="support" title={t("support.title")}>
        <p className="text-sm text-ink-muted">{t("support.body")}</p>
        <SupportRequestForm kind="other" />
        {requests.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line border-t border-line pt-3 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t(`support.kinds.${r.kind}`)}</span>
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {t(`support.statuses.${r.status}`)}
                  </span>
                  <time className="text-xs text-ink-muted" dateTime={r.createdAt}>
                    {format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })}
                  </time>
                </div>
                {r.resolutionNote ? (
                  <p className="text-ink-muted" dir="auto">
                    {t("support.reply")}: {r.resolutionNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card id="soon" title={t("advanced.soonTitle")}>
        <ul className="flex flex-col gap-2 text-sm">
          {SOON.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2 text-ink-muted">
              <span>{t(`advanced.soon.${item.key}`)}</span>
              <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">
                {tNav("soon")} · {item.stage}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
