/** Logotype: a mark with the Arabic letter lam (لسان) and the wordmark, direction-neutral. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-xl bg-accent text-xl font-bold leading-none text-white shadow-sm"
      >
        ل
      </span>
      {compact ? null : (
        <span className="text-lg font-bold tracking-tight" dir="ltr">
          LisanHub
        </span>
      )}
    </span>
  );
}
