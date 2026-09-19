import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CreateCourseForm } from "@/components/editor/content-forms";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSession } from "@/server/actor";
import { listLanguagePairs } from "@/server/queries/account";

/** A new course: an ordered set of the creator's own packages for one language pair (decision R11). */
export default async function NewCoursePage({ params }: PageProps<"/[locale]/content/new/course">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations("editor.course"), getSession()]);
  if (session.actor.kind !== "user") return null;
  const pairs = await listLanguagePairs(session.actor.userId);

  return (
    <Card id="new-course" title={t("newTitle")}>
      <p className="text-sm text-ink-muted">{t("lede")}</p>
      {pairs.length === 0 ? (
        <Alert tone="info">
          <span>{t("noPairs")}</span>
          <Link href="/account/languages" className="font-semibold text-accent underline-offset-4 hover:underline">
            {t("addPair")}
          </Link>
        </Alert>
      ) : null}
      <CreateCourseForm
        pairs={pairs.map((p) => ({
          id: p.id,
          label: `${p.native.name} → ${p.target.name}${p.dialect ? ` (${p.dialect})` : ""}`,
        }))}
      />
    </Card>
  );
}
