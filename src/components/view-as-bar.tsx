"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import type { ViewAs } from "@/modules/authorization/roles";
import { setViewAs } from "@/server/actions/account";

/**
 * Shown only while the Platform Owner is viewing the platform as a narrower
 * rank or role (decision R6): a reminder of the emulated permissions and the
 * way back. The chooser itself lives in the account menu.
 */
export function ViewAsBar({ viewingAs }: { viewingAs: ViewAs }) {
  const t = useTranslations("viewAs");
  const locale = useLocale();
  const pathname = usePathname();
  const fullPath = `/${locale}${pathname === "/" ? "" : pathname}`;

  return (
    <div className="border-b border-saffron/40 bg-saffron-soft">
      <form
        action={setViewAs}
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-1.5 text-xs sm:px-8"
      >
        <input type="hidden" name="pathname" value={fullPath} />
        <input type="hidden" name="viewAs" value="" />
        <span className="font-semibold text-saffron">{t("active", { rank: t(`options.${viewingAs}`) })}</span>
        <button
          type="submit"
          className="h-7 rounded-[var(--radius-control)] bg-saffron px-3 font-semibold text-white hover:opacity-90"
        >
          {t("exit")}
        </button>
        <span className="text-ink-muted">{t("note")}</span>
      </form>
    </div>
  );
}
