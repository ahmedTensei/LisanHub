"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { inputClass } from "@/components/ui/field";

export interface LanguageOption {
  code: string;
  iso639_1: string | null;
  name_en: string;
  direction: string;
}

interface Props {
  name: string;
  inputId: string;
  describedBy?: string;
  invalid?: boolean;
}

/**
 * Combobox over the ISO 639-3 table: type an English name or a code, pick a
 * result. The chosen code travels in a hidden input named `name`.
 */
export function LanguagePicker({ name, inputId, describedBy, invalid }: Props) {
  const t = useTranslations("languages.picker");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LanguageOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<LanguageOption | null>(null);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    };
  }, []);

  async function search(q: string) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch(`/api/languages?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      const body = (await res.json()) as { items: LanguageOption[] };
      setResults(body.items);
      setActive(0);
      setOpen(true);
    } catch {
      // Aborted or offline: keep the previous results.
    } finally {
      if (abort.current === controller) setSearching(false);
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => void search(q), 200);
  }

  function choose(option: LanguageOption) {
    setSelected(option);
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  if (selected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name={name} value={selected.code} />
        <span className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-accent/40 bg-accent-soft px-3.5 text-sm">
          <span className="sr-only">{t("selected")}: </span>
          <span dir="ltr">
            {selected.name_en} <span className="text-ink-muted">({selected.code})</span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          {t("clear")}
        </button>
      </div>
    );
  }

  const showList = open && query.trim().length >= 2;

  return (
    <div className="relative">
      <input type="hidden" name={name} value="" />
      <input
        id={inputId}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].code}` : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        dir="auto"
        placeholder={t("placeholder")}
        className={inputClass}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("results")}
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-[var(--radius-control)] bg-surface-raised p-1.5 shadow-[var(--shadow-menu)]"
        >
          {searching && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{t("searching")}</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">{t("noResults")}</li>
          ) : (
            results.map((option, index) => (
              <li
                key={option.code}
                id={`${listId}-${option.code}`}
                role="option"
                aria-selected={index === active}
                dir="ltr"
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${index === active ? "bg-accent-soft text-accent-strong" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.name_en} <span className="text-ink-muted">({option.code})</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
