import type { ReactNode } from "react";

export function Card({ title, children, id }: { title?: string; children: ReactNode; id?: string }) {
  return (
    <section
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7"
    >
      {title ? (
        <h2 id={id ? `${id}-title` : undefined} className="text-lg font-bold">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
