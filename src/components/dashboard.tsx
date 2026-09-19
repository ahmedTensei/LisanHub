import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { can } from "@/modules/authorization/capabilities";
import type { Actor } from "@/modules/authorization/roles";
import { countLanguagePairs } from "@/server/queries/account";
import { CloudCheckIcon, CompassIcon, LanguagesIcon, PeopleIcon, UserIcon } from "./ui/icons";

interface DashboardProps {
  actor: Extract<Actor, { kind: "user" }>;
  displayName: string;
}

/** Every section the platform will have; the ones not built yet carry their stage so the map is honest. */
const SECTIONS = [
  { key: "learning", icon: CompassIcon, stage: "S3" },
  { key: "community", icon: PeopleIcon, stage: "S5" },
  { key: "chats", icon: PeopleIcon, stage: "S5" },
  { key: "notifications", icon: UserIcon, stage: "S4" },
] as const;

/** Home page for a signed-in member: their own space, not the visitor landing page. */
export async function Dashboard({ actor, displayName }: DashboardProps) {
  const [t, tNav, pairs] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("nav"),
    countLanguagePairs(actor.userId),
  ]);
  const isCreator = can(actor, "content.create");
  const isContributor = can(actor, "plugins.author");
  const isStaff = can(actor, "moderation.handle_queue");
  const card =
    "flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">
          {t("greeting")} <span dir="auto">{displayName}</span>
        </h1>
        <p className="text-ink-muted">{t(isCreator ? "ledeCreator" : "ledeStudent")}</p>
      </header>

      <section aria-labelledby="ready" className="flex flex-col gap-4">
        <h2 id="ready" className="text-lg font-bold">
          {t("readyTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          <li>
            <Link href="/account/languages" className={`${card} h-full hover:border-line-strong`}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <LanguagesIcon className="size-5" />
              </span>
              <span className="font-bold">{t("languages.title")}</span>
              <span className="text-sm text-ink-muted">{t("languages.body", { count: pairs })}</span>
            </Link>
          </li>
          <li>
            <Link href="/account" className={`${card} h-full hover:border-line-strong`}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <UserIcon className="size-5" />
              </span>
              <span className="font-bold">{t("account.title")}</span>
              <span className="text-sm text-ink-muted">{t("account.body")}</span>
            </Link>
          </li>
          {isCreator ? (
            <li>
              <Link href="/content" className={`${card} h-full hover:border-line-strong`}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <CloudCheckIcon className="size-5" />
                </span>
                <span className="font-bold">{t("myContent.title")}</span>
                <span className="text-sm text-ink-muted">{t("myContent.body")}</span>
              </Link>
            </li>
          ) : null}
          {isContributor ? (
            <li>
              <Link href="/studio" className={`${card} h-full hover:border-line-strong`}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <CloudCheckIcon className="size-5" />
                </span>
                <span className="font-bold">{t("studio.title")}</span>
                <span className="text-sm text-ink-muted">{t("studio.body")}</span>
              </Link>
            </li>
          ) : null}
          {isStaff ? (
            <li>
              <Link href="/admin" className={`${card} h-full border-saffron/40 hover:border-saffron`}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
                  <PeopleIcon className="size-5" />
                </span>
                <span className="font-bold">{t("admin.title")}</span>
                <span className="text-sm text-ink-muted">{t("admin.body")}</span>
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="soon" className="flex flex-col gap-4">
        <h2 id="soon" className="text-lg font-bold">
          {t("soonTitle")}
        </h2>
        <p className="text-sm text-ink-muted">{t("soonBody")}</p>
        <ul className="grid gap-4 sm:grid-cols-3">
          {SECTIONS.map(({ key, icon: Icon, stage }) => (
            <li key={key} className={`${card} opacity-80`}>
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-paper text-ink-muted">
                  <Icon className="size-5" />
                </span>
                <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">
                  {tNav("soon")} · {stage}
                </span>
              </div>
              <span className="font-bold">{t(`sections.${key}.title`)}</span>
              <span className="text-sm text-ink-muted">{t(`sections.${key}.body`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
