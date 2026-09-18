"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./button";

interface ConfirmSubmitProps {
  /** Label of the first button (e.g. "Save"). */
  label: string;
  /** Question shown before the real submit; defaults to the generic one. */
  question?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
  pending?: boolean;
}

/**
 * Two-step submit (Ahmed, 2026-09-17): nothing in the account changes on a
 * single click. The first click arms the form and shows the question; only the
 * confirm button actually submits. Cancel disarms without submitting.
 */
export function ConfirmSubmit({
  label,
  question,
  variant = "primary",
  size = "md",
  pending = false,
}: ConfirmSubmitProps) {
  const t = useTranslations("forms.confirm");
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant={variant} size={size} onClick={() => setArmed(true)} disabled={pending}>
        {label}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={question ?? t("question")}
      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-saffron/40 bg-saffron-soft px-3 py-2"
    >
      <span className="text-sm font-semibold text-saffron">{question ?? t("question")}</span>
      <Button type="submit" variant={variant === "danger" ? "danger" : "primary"} size="sm" disabled={pending}>
        {pending ? t("working") : t("confirm")}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => setArmed(false)} disabled={pending}>
        {t("cancel")}
      </Button>
    </div>
  );
}
