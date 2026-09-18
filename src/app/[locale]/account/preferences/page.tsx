import { getTranslations, setRequestLocale } from "next-intl/server";
import { PreferencesForm } from "@/components/forms/account-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/actor";
import { getOwnProfile } from "@/server/queries/account";

const SOON = [
  { key: "notifications", stage: "S4" },
  { key: "theme", stage: "S6" },
] as const;

export default async function PreferencesPage({ params, searchParams }: PageProps<"/[locale]/account/preferences">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/preferences`);
  const [t, tNav, profile, query] = await Promise.all([
    getTranslations("account"),
    getTranslations("nav"),
    getOwnProfile(session.actor.userId),
    searchParams,
  ]);
  if (!profile) throw new Error("profile missing");
  const saved = query.notice === "saved";

  return (
    <>
      {saved ? <Alert tone="success">{t("notices.saved")}</Alert> : null}
      <Card id="preferences" title={t("preferences.title")}>
        <PreferencesForm uiLocale={profile.uiLocale} visibility={profile.visibility} />
      </Card>
      <Card id="soon" title={t("preferences.soonTitle")}>
        <ul className="flex flex-col gap-2 text-sm">
          {SOON.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2 text-ink-muted">
              <span>{t(`preferences.soon.${item.key}`)}</span>
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
