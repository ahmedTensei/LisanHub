"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export interface SectionNavItem {
  href: string;
  labelKey: string;
  /** Feature not built yet: shown with a stage badge, not a link. */
  soon?: string;
  badge?: number;
}

/**
 * Secondary navigation of an area (account settings, administration): a
 * vertical list on wide screens, a horizontal scrolling strip on phones.
 */
export function SectionNav({ namespace, items, label }: { namespace: string; items: SectionNavItem[]; label: string }) {
  const t = useTranslations(namespace);
  const tCommon = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 sm:flex-col">
        {items.map((item) => {
          const active = pathname === item.href;
          const base =
            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-sm";
          if (item.soon) {
            return (
              <li key={item.href}>
                <span aria-disabled="true" className={`${base} text-ink-muted/70`}>
                  {t(item.labelKey)}
                  <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">
                    {tCommon("soon")} · {item.soon}
                  </span>
                </span>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${base} ${active ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink hover:bg-accent-soft/60"}`}
              >
                {t(item.labelKey)}
                {item.badge ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
