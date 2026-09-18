"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { VIEW_AS_OPTIONS, type ViewAs } from "@/modules/authorization/roles";
import { setViewAs } from "@/server/actions/account";
import { signOut } from "@/server/actions/auth";
import { Dropdown, MenuDivider, menuItemClass } from "./ui/dropdown";
import { ChevronDownIcon, GlobeIcon, LanguagesIcon, PeopleIcon, SignOutIcon, UserIcon } from "./ui/icons";

/** Account menu for signed-in users: profile, language pairs, sign out. */
export function UserMenu({
  username,
  displayName,
  avatarUrl,
  isStaff = false,
  isOwner = false,
  viewingAs = null,
}: {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isStaff?: boolean;
  isOwner?: boolean;
  viewingAs?: ViewAs | null;
}) {
  const t = useTranslations("nav");
  const tViewAs = useTranslations("viewAs");
  const locale = useLocale();
  const pathname = usePathname();
  const fullPath = `/${locale}${pathname === "/" ? "" : pathname}`;
  const initial = displayName.trim().charAt(0).toUpperCase() || username.charAt(0).toUpperCase() || "?";

  return (
    <Dropdown
      label={t("accountMenu")}
      triggerClassName="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface ps-1 pe-3 text-sm font-semibold text-ink hover:border-line-strong"
      trigger={
        <>
          <span
            aria-hidden="true"
            className="relative flex size-8 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-bold text-white"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="32px" unoptimized className="object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="hidden max-w-32 truncate sm:inline" dir="auto">
            {displayName}
          </span>
          <ChevronDownIcon className="size-4 text-ink-muted" />
        </>
      }
    >
      <div className="px-3 pt-1 pb-2">
        <p className="truncate text-sm font-semibold" dir="auto">
          {displayName}
        </p>
        <p className="truncate text-xs text-ink-muted" dir="ltr">
          @{username}
        </p>
      </div>
      <Link href="/account" role="menuitem" className={menuItemClass}>
        <UserIcon className="size-4 text-ink-muted" />
        {t("account")}
      </Link>
      <Link href={`/u/${username}`} role="menuitem" className={menuItemClass}>
        <GlobeIcon className="size-4 text-ink-muted" />
        {t("publicProfile")}
      </Link>
      <Link href="/account/languages" role="menuitem" className={menuItemClass}>
        <LanguagesIcon className="size-4 text-ink-muted" />
        {t("languages")}
      </Link>
      {isStaff ? (
        <Link href="/admin" role="menuitem" className={menuItemClass}>
          <PeopleIcon className="size-4 text-saffron" />
          {t("admin")}
        </Link>
      ) : null}
      {isOwner ? (
        <>
          <MenuDivider />
          <p className="px-3 pt-1 pb-1 text-xs font-semibold text-ink-muted">{tViewAs("label")}</p>
          <form action={setViewAs} className="flex flex-col">
            <input type="hidden" name="pathname" value={fullPath} />
            {VIEW_AS_OPTIONS.map((option) => (
              <button
                key={option}
                type="submit"
                name="viewAs"
                value={option}
                role="menuitemradio"
                aria-checked={viewingAs === option}
                aria-current={viewingAs === option ? "true" : undefined}
                className={menuItemClass}
              >
                {tViewAs(`options.${option}`)}
              </button>
            ))}
            {viewingAs ? (
              <button type="submit" name="viewAs" value="" role="menuitem" className={`${menuItemClass} text-saffron`}>
                {tViewAs("exit")}
              </button>
            ) : null}
          </form>
        </>
      ) : null}
      <MenuDivider />
      <form action={signOut.bind(null, locale)}>
        <button type="submit" role="menuitem" className={menuItemClass}>
          <SignOutIcon className="size-4 text-ink-muted" />
          {t("signOut")}
        </button>
      </form>
    </Dropdown>
  );
}
