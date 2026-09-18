import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileForm } from "@/components/forms/account-forms";
import { AvatarForm } from "@/components/forms/avatar-form";
import { CopyLink } from "@/components/copy-link";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/actor";
import { avatarUrl, getOwnProfile } from "@/server/queries/account";

const NOTICES = new Set(["confirmed", "welcome", "saved", "content_creator"]);

export default async function AccountProfilePage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account`);
  const [t, tRole, profile, query] = await Promise.all([
    getTranslations("account"),
    getTranslations("account.role"),
    getOwnProfile(session.actor.userId),
    searchParams,
  ]);
  if (!profile) throw new Error("profile missing");
  const picture = await avatarUrl(profile.avatarKey);
  const notice = typeof query.notice === "string" && NOTICES.has(query.notice) ? query.notice : null;

  return (
    <>
      {notice ? <Alert tone="success">{t(`notices.${notice}`)}</Alert> : null}
      <Card id="avatar" title={t("avatar.title")}>
        <AvatarForm avatarUrl={picture} displayName={profile.displayName} />
      </Card>
      <Card id="profile" title={t("profile.title")}>
        <ProfileForm
          username={profile.username}
          displayName={profile.displayName}
          bio={profile.bio}
          location={profile.location}
        />
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-sm font-semibold">{t("profile.publicLink")}</p>
          <p className="text-xs text-ink-muted">{t("profile.publicLinkHint")}</p>
          <CopyLink path={`/${locale}/u/${profile.username}`} />
          <Link
            href={`/u/${profile.username}`}
            className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            {t("profile.viewPublic")}
          </Link>
        </div>
      </Card>
      <Card id="role" title={tRole("title")}>
        <p className="text-sm">
          <span className="text-ink-muted">{tRole("current")}: </span>
          <span className="font-semibold">{tRole(profile.primaryRole)}</span>
          {profile.isFoundingMember ? (
            <span className="ms-2 rounded-full bg-saffron-soft px-2 py-0.5 text-xs font-semibold text-saffron">
              {t("foundingBadge")}
            </span>
          ) : null}
        </p>
        <p className="text-sm text-ink-muted">
          {session.isOwner
            ? tRole("ownerNote")
            : profile.primaryRole === "student"
              ? tRole("studentExplanation")
              : tRole("creatorExplanation")}
        </p>
      </Card>
    </>
  );
}
