import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ActionForm } from "@/components/forms/action-form";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { canAssignRank, canSetPrimaryRoleAsAdmin } from "@/modules/authorization/policies";
import { ADMIN_RANKS } from "@/modules/authorization/roles";
import { setMemberRank, setMemberRole } from "@/server/actions/admin";
import { getSession, requireCapability } from "@/server/actor";
import { listMembers } from "@/server/queries/admin";

export default async function AdminUsersPage({ params, searchParams }: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "admin.manage_users", `/${locale}/admin/users`);
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.slice(0, 60) : "";
  const [t, tRole, format, session, members] = await Promise.all([
    getTranslations("admin.users"),
    getTranslations("account.role"),
    getFormatter(),
    getSession(),
    listMembers(search),
  ]);
  const setRole = setMemberRole.bind(null, locale);
  const setRank = setMemberRank.bind(null, locale);
  const mayChangeRoles = canSetPrimaryRoleAsAdmin(session.actor).allowed;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-ink-muted">{t("lede")}</p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder={t("searchPlaceholder")}
          dir="auto"
          className={`${inputClass} h-10 w-full sm:w-80`}
        />
        <Button type="submit" variant="secondary" size="sm">
          {t("search")}
        </Button>
      </form>

      {members.length === 0 ? <p className="text-sm text-ink-muted">{t("empty")}</p> : null}

      <ul className="flex flex-col gap-3">
        {members.map((member) => {
          const isSelf = session.actor.kind === "user" && session.actor.userId === member.id;
          const rankOptions = [null, ...ADMIN_RANKS].filter(
            (rank) => canAssignRank(session.actor, { userId: member.id, adminRank: member.adminRank }, rank).allowed,
          );
          return (
            <li
              key={member.id}
              className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/admin/users/${member.username}`}
                  className="font-semibold hover:text-accent-strong"
                  dir="auto"
                >
                  {member.displayName}
                </Link>
                <span className="text-ink-muted" dir="ltr">
                  @{member.username}
                </span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                  {tRole(member.primaryRole)}
                </span>
                {member.adminRank ? (
                  <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">
                    {t(`ranks.${member.adminRank}`)}
                  </span>
                ) : null}
                {member.isFoundingMember ? (
                  <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {t("founding")}
                  </span>
                ) : null}
                <span className="text-xs text-ink-muted">
                  {t(`visibility.${member.visibility}`)} ·{" "}
                  <time dateTime={member.createdAt}>
                    {format.dateTime(new Date(member.createdAt), { dateStyle: "medium" })}
                  </time>
                </span>
              </div>

              <div className="flex flex-wrap gap-4">
                {mayChangeRoles && member.primaryRole !== "contributor" ? (
                  <ActionForm
                    action={setRole}
                    messages="admin"
                    hidden={{
                      userId: member.id,
                      role: member.primaryRole === "student" ? "content_creator" : "student",
                    }}
                    submitLabel={member.primaryRole === "student" ? t("makeCreator") : t("makeStudent")}
                  />
                ) : null}
                {!isSelf && rankOptions.length > 1 ? (
                  <ActionForm
                    action={setRank}
                    messages="admin"
                    hidden={{ userId: member.id, currentRank: member.adminRank ?? "" }}
                    submitLabel={t("applyRank")}
                  >
                    <select name="rank" defaultValue={member.adminRank ?? ""} className={`${inputClass} h-9 w-auto`}>
                      {rankOptions.map((rank) => (
                        <option key={rank ?? "none"} value={rank ?? ""}>
                          {rank ? t(`ranks.${rank}`) : t("ranks.none")}
                        </option>
                      ))}
                    </select>
                  </ActionForm>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
