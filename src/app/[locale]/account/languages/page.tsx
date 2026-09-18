import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguagePairForm } from "@/components/forms/language-pair-form";
import { RemovePairForm } from "@/components/forms/remove-pair-form";
import { Card } from "@/components/ui/card";
import { removeLanguagePair } from "@/server/actions/account";
import { requireUser } from "@/server/actor";
import { listLanguagePairs } from "@/server/queries/account";

export default async function LanguagePairsPage({ params }: PageProps<"/[locale]/account/languages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireUser(locale, `/${locale}/account/languages`);
  const [t, pairs] = await Promise.all([getTranslations("languages"), listLanguagePairs(session.actor.userId)]);
  const remove = removeLanguagePair.bind(null, locale);

  return (
    <>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      <Card id="pairs" title={t("list.title")}>
        {pairs.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {pairs.map((pair) => (
              <li key={pair.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">
                    <span dir="ltr">
                      {pair.native.name} → {pair.target.name}
                    </span>
                    <span className="ms-2 text-xs font-normal text-ink-muted" dir="ltr">
                      ({pair.native.code} → {pair.target.code})
                    </span>
                  </p>
                  {pair.dialect ? (
                    <p className="text-sm text-ink-muted">
                      {t("list.dialect")}: <span dir="ltr">{pair.dialect}</span>
                    </p>
                  ) : null}
                  {pair.goal ? (
                    <p className="text-sm text-ink-muted">
                      {t("list.goal")}: {pair.goal}
                    </p>
                  ) : null}
                </div>
                <RemovePairForm
                  action={remove}
                  id={pair.id}
                  label={t("list.remove")}
                  question={t("list.removeAria", { native: pair.native.name, target: pair.target.name })}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card id="add" title={t("add.title")}>
        <LanguagePairForm />
      </Card>
    </>
  );
}
