import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { canAssignRank, canOverseeAll, canSetPrimaryRoleAsAdmin } from "@/modules/authorization/policies";
import { isUiLocale, UI_LOCALE_NAMES } from "@/modules/account/ui-locales";
import { ADMIN_RANKS } from "@/modules/authorization/roles";
import { localizedTitle } from "@/modules/content/package-input";
import { setMemberRank, setMemberRole } from "@/server/actions/admin";
import { getSession, requireCapability } from "@/server/actor";
import { getMemberOversight } from "@/server/queries/oversight";

/**
 * One member as the administration sees them (decision R17): account state,
 * role and rank with the same actions as the members list, then — for the
 * owner and super administrators — everything they made: content, plugins
 * and support requests, each opening its own oversight page.
 */
export default async function AdminMemberPage({ params }: PageProps<"/[locale]/admin/users/[username]">) {
  const { locale, username } = await params;
  setRequestLocale(locale);
  await requireCapability(locale, "admin.manage_users", `/${locale}/admin/users/${username}`);
  const [t, tUsers, tRole, tStatus, tPluginStatus, tSupport, format, session, oversight] = await Promise.all([
    getTranslations("admin.member"),
    getTranslations("admin.users"),
    getTranslations("account.role"),
    getTranslations("editor.statuses"),
    getTranslations("studio.status"),
    getTranslations("admin.requests"),
    getFormatter(),
    getSession(),
    getMemberOversight(username),
  ]);
  if (!oversight) notFound();
  const { member, content, plugins, supportRequests } = oversight;
  const oversee = canOverseeAll(session.actor).allowed;
  const isSelf = session.actor.kind === "user" && session.actor.userId === member.id;
  const mayChangeRoles = canSetPrimaryRoleAsAdmin(session.actor).allowed;
  const rankOptions = [null, ...ADMIN_RANKS].filter(
    (rank) => canAssignRank(session.actor, { userId: member.id, adminRank: member.adminRank }, rank).allowed,
  );
  const setRole = setMemberRole.bind(null, locale);
  const setRank = setMemberRank.bind(null, locale);
  const linkClass = "font-semibold text-accent underline-offset-4 hover:underline";

  return (
    <div className="flex flex-col gap-6">
      <Card id="member" title={member.displayName}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted" dir="ltr">
            @{member.username}
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
            {tRole(member.primaryRole)}
          </span>
          {member.adminRank ? (
            <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">
              {tUsers(`ranks.${member.adminRank}`)}
            </span>
          ) : null}
          {member.isFoundingMember ? (
            <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
              {tUsers("founding")}
            </span>
          ) : null}
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">{t("visibility")}</dt>
            <dd>{tUsers(`visibility.${member.visibility === "restricted" ? "restricted" : "public"}`)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("memberSince")}</dt>
            <dd>{format.dateTime(new Date(member.createdAt), { dateStyle: "medium" })}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("uiLocale")}</dt>
            <dd>{isUiLocale(member.uiLocale) ? UI_LOCALE_NAMES[member.uiLocale] : member.uiLocale}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t("location")}</dt>
            <dd dir="auto">{member.location || "—"}</dd>
          </div>
        </dl>
        {member.bio ? (
          <p className="text-sm" dir="auto">
            {member.bio}
          </p>
        ) : null}
        <p className="text-sm">
          <Link href={`/u/${member.username}`} className={linkClass}>
            {t("publicPage")}
          </Link>
        </p>
        <div className="flex flex-wrap gap-4">
          {mayChangeRoles && member.primaryRole !== "contributor" ? (
            <ActionForm
              action={setRole}
              messages="admin"
              hidden={{ userId: member.id, role: member.primaryRole === "student" ? "content_creator" : "student" }}
              submitLabel={member.primaryRole === "student" ? tUsers("makeCreator") : tUsers("makeStudent")}
            />
          ) : null}
          {!isSelf && rankOptions.length > 1 ? (
            <ActionForm
              action={setRank}
              messages="admin"
              hidden={{ userId: member.id, currentRank: member.adminRank ?? "" }}
              submitLabel={tUsers("applyRank")}
            >
              <select name="rank" defaultValue={member.adminRank ?? ""} className={`${inputClass} h-9 w-auto`}>
                {rankOptions.map((rank) => (
                  <option key={rank ?? "none"} value={rank ?? ""}>
                    {rank ? tUsers(`ranks.${rank}`) : tUsers("ranks.none")}
                  </option>
                ))}
              </select>
            </ActionForm>
          ) : null}
        </div>
      </Card>

      {oversee ? (
        <>
          <Card id="content" title={t("contentTitle", { count: content.length })}>
            {content.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("noContent")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {content.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/content/${row.id}`} className={linkClass} dir="auto">
                      {localizedTitle(row, locale)}
                    </Link>
                    <span className="text-xs text-ink-muted">{tStatus(row.status)}</span>
                    {row.pluginId ? <code className="field-ltr text-xs text-ink-muted">{row.pluginId}</code> : null}
                    <time className="text-xs text-ink-muted" dateTime={row.updatedAt}>
                      {format.dateTime(new Date(row.updatedAt), { dateStyle: "medium" })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card id="plugins" title={t("pluginsTitle", { count: plugins.length })}>
            {plugins.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("noPlugins")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {plugins.map((plugin) => (
                  <li key={plugin.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/plugins/${plugin.id}`} className={`${linkClass} field-ltr`}>
                      {plugin.pluginId}
                    </Link>
                    <span className="text-xs text-ink-muted">{tPluginStatus(plugin.status)}</span>
                    {plugin.disabled ? (
                      <span className="text-xs font-semibold text-danger">{tPluginStatus("disabled")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card id="support" title={t("supportTitle", { count: supportRequests.length })}>
            {supportRequests.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("noSupport")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {supportRequests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span>{tSupport(`kinds.${r.kind}`)}</span>
                    <span className="text-xs text-ink-muted">{tSupport(`statuses.${r.status}`)}</span>
                    <time className="text-xs text-ink-muted" dateTime={r.createdAt}>
                      {format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
