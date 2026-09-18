import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3.5 text-ink placeholder:text-ink-muted/60 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  children: ReactNode;
}

/** Label, control, hint and error wired together for assistive technology. */
export function Field({ id, label, hint, error, optionalLabel, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optionalLabel ? <span className="ms-2 text-xs font-normal text-ink-muted">({optionalLabel})</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}
