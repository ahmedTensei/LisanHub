"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { UI_LOCALES } from "@/modules/account/ui-locales";
import { changeUiLocale } from "@/server/actions/account";
import { Dropdown, menuItemClass } from "./ui/dropdown";
import { GlobeIcon, CheckIcon } from "./ui/icons";

/** Native names: what a person looks for when the interface is in a language they do not read. */
const NATIVE_NAMES: Record<string, string> = { ar: "العربية", fr: "Français", en: "English" };

/**
 * Interface language switcher behind a single globe icon. Signed-in users'
 * choice is saved to their profile by the action, so it follows them everywhere.
 */
export function LanguageMenu({ placement = "down" }: { placement?: "down" | "up" }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <Dropdown
      label={t("uiLanguage")}
      panelClassName="w-48"
      placement={placement}
      triggerClassName="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink hover:border-line-strong hover:text-accent-strong"
      trigger={
        <>
          <GlobeIcon className="size-5" />
          <span className="hidden sm:inline" lang={locale}>
            {NATIVE_NAMES[locale] ?? locale}
          </span>
        </>
      }
    >
      <form action={changeUiLocale} className="flex flex-col">
        <input type="hidden" name="pathname" value={pathname} />
        {UI_LOCALES.map((l) => (
          <button
            key={l}
            type="submit"
            name="locale"
            value={l}
            role="menuitemradio"
            aria-checked={l === locale}
            aria-current={l === locale ? "true" : undefined}
            lang={l}
            className={menuItemClass}
          >
            <span className="flex-1">{NATIVE_NAMES[l] ?? l}</span>
            {l === locale ? <CheckIcon className="size-4 text-accent" /> : null}
          </button>
        ))}
      </form>
    </Dropdown>
  );
}
