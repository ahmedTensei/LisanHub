import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { can } from "@/modules/authorization/capabilities";
import { getSession } from "@/server/actor";
import { avatarUrl } from "@/server/queries/account";
import { Brand } from "./brand";
import { LanguageMenu } from "./language-menu";
import { UserMenu } from "./user-menu";
import { ViewAsBar } from "./view-as-bar";

/** Top bar: brand at the start, account actions and the interface-language menu at the end. */
export async function SiteHeader() {
  const [t, session] = await Promise.all([getTranslations("nav"), getSession()]);
  const signedIn = session.actor.kind === "user";
  const isStaff = can(session.actor, "moderation.handle_queue");
  const isCreator = can(session.actor, "content.create");
  const isContributor = can(session.actor, "plugins.author");
  const navLink =
    "hidden h-10 items-center rounded-full px-3 text-sm font-semibold text-ink hover:bg-accent-soft hover:text-accent-strong md:inline-flex";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" className="rounded-lg" aria-label={t("home")}>
          <Brand />
        </Link>
        <nav aria-label={t("menu")} className="flex items-center gap-2">
          {signedIn ? (
            <>
              <Link href="/" className={navLink}>
                {t("home")}
              </Link>
              <Link href="/account/languages" className={navLink}>
                {t("languages")}
              </Link>
              {isCreator ? (
                <Link href="/content" className={navLink}>
                  {t("myContent")}
                </Link>
              ) : null}
              {isContributor ? (
                <Link href="/studio" className={navLink}>
                  {t("studio")}
                </Link>
              ) : null}
              {isStaff ? (
                <Link href="/admin" className={`${navLink} text-saffron hover:text-saffron`}>
                  {t("admin")}
                </Link>
              ) : null}
              <UserMenu
                username={session.username ?? "…"}
                displayName={session.displayName ?? session.username ?? "…"}
                avatarUrl={await avatarUrl(session.avatarKey)}
                isStaff={isStaff}
                isOwner={session.isOwner}
                viewingAs={session.viewingAs}
              />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-ink hover:bg-accent-soft hover:text-accent-strong sm:inline-flex"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong"
              >
                {t("signUp")}
              </Link>
            </>
          )}
          {signedIn ? null : <LanguageMenu />}
        </nav>
      </div>
      {session.viewingAs ? <ViewAsBar viewingAs={session.viewingAs} /> : null}
    </header>
  );
}
