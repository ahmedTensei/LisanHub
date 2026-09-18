"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface DropdownProps {
  /** Accessible name of the trigger. */
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
  /** Width of the panel. */
  panelClassName?: string;
  /** Where the panel opens; "up" for triggers near the bottom of the page. */
  placement?: "down" | "up";
}

/**
 * Small accessible menu: opens on click, closes on Escape, outside click or
 * when an item is activated. Anchored to the end of the trigger, so it mirrors
 * correctly in RTL.
 */
export function Dropdown({
  label,
  trigger,
  children,
  triggerClassName = "",
  panelClassName = "w-56",
  placement = "down",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label={label}
          onClick={(e) => {
            // Links navigate client-side, so the menu closes itself; form buttons
            // stay mounted until their server action redirects the page.
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className={`menu-in absolute end-0 z-20 overflow-hidden ${placement === "up" ? "bottom-full mb-2" : "top-full mt-2"} rounded-[var(--radius-control)] bg-surface-raised p-1.5 shadow-[var(--shadow-menu)] ${panelClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm text-ink hover:bg-accent-soft hover:text-accent-strong aria-[current=true]:font-semibold aria-[current=true]:text-accent";

export function MenuDivider() {
  return <div role="separator" className="my-1.5 border-t border-line" />;
}
