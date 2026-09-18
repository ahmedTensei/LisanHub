import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getPublicProfile } from "@/server/queries/account";

/**
 * A member's public page. Row level security decides what is visible: a
 * restricted profile answers 404 to everyone but its owner and moderation.
 */
export default async function PublicProfilePage({ params }: PageProps<"/[locale]/u/[username]">) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const [t, tRole, format] = await Promise.all([
    getTranslations("profile"),
    getTranslations("account.role"),
    getFormatter(),
  ]);
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-8 sm:py-14">
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)] sm:flex-row sm:items-start sm:text-start">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-line bg-accent-soft">
          {profile.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" fill sizes="96px" unoptimized className="object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center text-3xl font-bold text-accent"
            >
              {initial}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-bold" dir="auto">
            {profile.displayName}
          </h1>
          <p className="text-sm text-ink-muted" dir="ltr">
            @{profile.username}
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
              {tRole(profile.primaryRole)}
            </span>
            {profile.isFoundingMember ? (
              <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-xs font-semibold text-saffron">
                {t("founding")}
              </span>
            ) : null}
          </div>
          {profile.bio ? (
            <p className="whitespace-pre-wrap text-sm" dir="auto">
              {profile.bio}
            </p>
          ) : null}
          <p className="text-xs text-ink-muted">
            {profile.location ? (
              <>
                <span dir="auto">{profile.location}</span> ·{" "}
              </>
            ) : null}
            {t("memberSince", { date: format.dateTime(new Date(profile.memberSince), { dateStyle: "long" }) })}
          </p>
        </div>
      </section>
      <p className="text-sm text-ink-muted">{t("moreSoon")}</p>
    </main>
  );
}
