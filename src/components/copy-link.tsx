"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";

/** Shows a full URL and copies it to the clipboard on request. */
export function CopyLink({ path }: { path: string }) {
  const t = useTranslations("profile");
  const [copied, setCopied] = useState(false);
  // The origin is only known in the browser; the server renders the path and the client fills it in after hydration.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${path}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-1.5 text-xs" dir="ltr">
        {url}
      </code>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard unavailable: the address stays visible to copy by hand.
          }
        }}
      >
        {copied ? t("copied") : t("copyLink")}
      </Button>
    </div>
  );
}
