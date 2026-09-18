import type { ReactNode } from "react";
import { AlertIcon, CheckCircleIcon, InfoIcon } from "./icons";

const TONES = {
  info: { box: "border-line bg-surface text-ink", icon: InfoIcon, iconClass: "text-ink-muted" },
  success: { box: "border-accent/30 bg-accent-soft text-ink", icon: CheckCircleIcon, iconClass: "text-accent" },
  error: { box: "border-danger/30 bg-danger-soft text-ink", icon: AlertIcon, iconClass: "text-danger" },
} as const;

export function Alert({ tone = "info", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  const { box, icon: Icon, iconClass } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-sm ${box}`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
