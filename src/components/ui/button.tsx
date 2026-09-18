import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-accent text-white shadow-sm hover:bg-accent-strong disabled:bg-accent/50",
  secondary:
    "border border-line bg-surface text-ink hover:border-line-strong hover:text-accent-strong disabled:opacity-60",
  danger: "border border-line bg-surface text-ink-muted hover:border-danger hover:text-danger disabled:opacity-60",
} as const;

const SIZES = { md: "h-11 px-5 text-sm", sm: "h-9 px-3.5 text-sm" } as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES };

export function Button({ variant = "primary", size = "md", className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
