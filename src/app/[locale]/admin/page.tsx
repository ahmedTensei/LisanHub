import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { can } from "@/modules/authorization/capabilities";
import { getSession } from "@/server/actor";
import { getAdminStats } from "@/server/queries/admin";

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-2xl font-bold" dir="ltr">
        {value}
      </span>
    </>
  );
  const cls =
    "flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]";
  return href ? (
    <Link href={href} className={`${cls} hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** The overview: every number in its section, sections filtered by what the rank may see. */
export default async function AdminOverviewPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tUsers, session, stats] = await Promise.all([
    getTranslations("admin.overview"),
    getTranslations("admin.users"),
    getSession(),
    getAdminStats(),
  ]);
  const actor = session.actor;
  const seesMembers = can(actor, "admin.manage_users");
  const seesSettings = can(actor, "admin.platform_settings");

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="work" className="flex flex-col gap-3">
        <h2 id="work" className="text-lg font-bold">
          {t("work.title")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <Stat label={t("work.openRequests")} value={stats.work.openRequests} href="/admin/requests" />
          </li>
          <li>
            <Stat label={t("work.inReviewRequests")} value={stats.work.inReviewRequests} href="/admin/requests" />
          </li>
          <li>
            <Stat label={t("work.newFeedback")} value={stats.work.newFeedback} href="/admin/feedback" />
          </li>
          <li>
            <Stat label={t("work.contentReports")} value={stats.work.contentReports} href="/admin/reports" />
          </li>
          <li>
            <Stat label={t("work.conductReports")} value={stats.work.conductReports} href="/admin/reports" />
          </li>
          <li>
            <Stat label={t("work.pluginRequests")} value={stats.work.pluginRequests} href="/admin/plugins" />
          </li>
        </ul>
      </section>

      <section aria-labelledby="plugins" className="flex flex-col gap-3">
        <h2 id="plugins" className="text-lg font-bold">
          {t("plugins.title")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <Stat label={t("plugins.published")} value={stats.plugins.published} href="/admin/plugins" />
          </li>
          <li>
            <Stat label={t("plugins.pending")} value={stats.plugins.pending} href="/admin/plugins" />
          </li>
          <li>
            <Stat label={t("plugins.disabled")} value={stats.plugins.disabled} href="/admin/plugins" />
          </li>
        </ul>
      </section>

      <section aria-labelledby="members" className="flex flex-col gap-3">
        <h2 id="members" className="text-lg font-bold">
          {t("members.title")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <Stat
              label={t("members.total")}
              value={stats.members.total}
              href={seesMembers ? "/admin/users" : undefined}
            />
          </li>
          <li>
            <Stat label={t("members.students")} value={stats.members.students} />
          </li>
          <li>
            <Stat label={t("members.creators")} value={stats.members.creators} />
          </li>
          <li>
            <Stat label={t("members.contributors")} value={stats.members.contributors} />
          </li>
          <li>
            <Stat label={t("members.founding")} value={stats.members.founding} />
          </li>
          <li>
            <Stat label={t("members.newLast7Days")} value={stats.members.newLast7Days} />
          </li>
        </ul>
        <h3 className="text-sm font-bold text-ink-muted">{t("members.byRank")}</h3>
        <ul className="grid gap-3 sm:grid-cols-4">
          {(["moderator", "administrator", "super_administrator", "platform_owner"] as const).map((rank) => (
            <li key={rank}>
              <Stat label={tUsers(`ranks.${rank}`)} value={stats.members.byRank[rank]} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="content" className="flex flex-col gap-3">
        <h2 id="content" className="text-lg font-bold">
          {t("content.title")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <Stat label={t("content.published")} value={stats.content.published} />
          </li>
          <li>
            <Stat label={t("content.drafts")} value={stats.content.drafts} />
          </li>
          <li>
            <Stat label={t("content.hidden")} value={stats.content.hidden} />
          </li>
        </ul>
        <p className="text-xs text-ink-muted">{t("content.hint")}</p>
      </section>

      {seesSettings ? (
        <section aria-labelledby="system" className="flex flex-col gap-3">
          <h2 id="system" className="text-lg font-bold">
            {t("system.title")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {stats.system.flags.map((flag) => (
              <li
                key={flag.key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  flag.mode === "enabled" ? "bg-accent-soft text-accent-strong" : "bg-saffron-soft text-saffron"
                }`}
                dir="ltr"
              >
                {flag.key}: {flag.mode}
              </li>
            ))}
          </ul>
          <Link href="/admin/settings" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
            {t("system.settingsLink", { count: stats.system.settings })}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
