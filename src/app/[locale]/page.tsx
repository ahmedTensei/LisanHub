import { getTranslations, setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/components/dashboard";
import { CloudCheckIcon, CompassIcon, PeopleIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/server/actor";

const PILLARS = [
  { key: "freedom", icon: CompassIcon },
  { key: "community", icon: PeopleIcon },
  { key: "progress", icon: CloudCheckIcon },
] as const;

/** Visitors get the landing page; signed-in members get their dashboard. */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations("home"), getSession()]);
  if (session.actor.kind === "user") {
    return <Dashboard actor={session.actor} displayName={session.displayName ?? session.username ?? ""} />;
  }

  const primary =
    "inline-flex h-12 items-center rounded-[var(--radius-control)] bg-accent px-6 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong";
  const secondary =
    "inline-flex h-12 items-center rounded-[var(--radius-control)] border border-line bg-surface px-6 text-sm font-semibold text-ink hover:border-line-strong hover:text-accent-strong";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 sm:px-8 sm:py-20">
      <section className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface px-6 py-12 shadow-[var(--shadow-card)] sm:px-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -end-24 size-72 rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative flex max-w-2xl flex-col gap-6">
          <p className="inline-flex w-fit items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl font-bold leading-tight text-balance sm:text-5xl">{t("title")}</h1>
          <p className="text-lg text-ink-muted">{t("lede")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/sign-up" className={primary}>
              {t("ctaSignUp")}
            </Link>
            <Link href="/sign-in" className={secondary}>
              {t("ctaSignIn")}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="pillars" className="flex flex-col gap-6">
        <h2 id="pillars" className="text-2xl font-bold">
          {t("pillarsTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="size-6" />
              </span>
              <h3 className="text-lg font-bold">{t(`pillars.${key}.title`)}</h3>
              <p className="text-sm text-ink-muted">{t(`pillars.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
