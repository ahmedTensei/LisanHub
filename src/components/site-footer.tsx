import { getTranslations } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSession } from "@/server/actor";
import { LanguageMenu } from "./language-menu";

/** Slim footer with the build stage and the database status (moved from the S0 home page). */
export async function SiteFooter() {
  const [t, session] = await Promise.all([getTranslations("footer"), getSession()]);
  const connected = isSupabaseConfigured();

  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          <span dir="ltr">LisanHub</span> · {t("stage")}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block size-2 rounded-full ${connected ? "bg-accent" : "bg-saffron"}`}
            />
            {t("database")}: {connected ? t("connected") : t("notConnected")}
          </p>
          {session.actor.kind === "user" ? <LanguageMenu placement="up" /> : null}
        </div>
      </div>
    </footer>
  );
}
