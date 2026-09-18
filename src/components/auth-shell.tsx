import type { ReactNode } from "react";
import { Brand } from "./brand";

/** Narrow centred layout shared by the account pages. */
export function AuthShell({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:py-14">
      <header className="flex flex-col items-center gap-4 text-center">
        <Brand compact />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">{title}</h1>
          {lede ? <p className="text-ink-muted">{lede}</p> : null}
        </div>
      </header>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
        {children}
      </div>
    </main>
  );
}
