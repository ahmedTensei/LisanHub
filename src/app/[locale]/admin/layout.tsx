import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionNav, type SectionNavItem } from "@/components/section-nav";
import { can } from "@/modules/authorization/capabilities";
import { requireCapability } from "@/server/actor";
import { getAdminOverview } from "@/server/queries/admin";

/**
 * Administration area: staff only (any administrative rank). Members without a
 * rank get a 404 so the area does not even appear to exist for them, and each
 * section is listed only for the ranks that hold its capability.
 */
export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireCapability(locale, "moderation.handle_queue", `/${locale}/admin`);
  const [t, overview] = await Promise.all([getTranslations("admin"), getAdminOverview()]);
  const actor = session.actor;

  const items: SectionNavItem[] = [{ href: "/admin", labelKey: "overview" }];
  if (can(actor, "moderation.handle_queue")) {
    items.push(
      { href: "/admin/requests", labelKey: "requests", badge: overview.openRequests },
      { href: "/admin/reports", labelKey: "reports", badge: overview.openReports + overview.openConductReports },
      { href: "/admin/feedback", labelKey: "feedback", badge: overview.newFeedback },
    );
  }
  if (can(actor, "admin.manage_users")) items.push({ href: "/admin/users", labelKey: "users" });
  if (can(actor, "admin.platform_settings")) items.push({ href: "/admin/settings", labelKey: "settings" });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-ink-muted">
          {t("lede")} · {t(`ranks.${actor.adminRank ?? "none"}`)}
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <SectionNav namespace="admin.nav" label={t("title")} items={items} />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </main>
  );
}
