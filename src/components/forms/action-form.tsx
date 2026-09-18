"use client";

import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { idle, type FormState } from "@/modules/account/forms";
import { Button } from "@/components/ui/button";
import { formError } from "./form-state";

type BoundAction = (prev: FormState, formData: FormData) => Promise<FormState>;

interface ActionFormProps {
  action: BoundAction;
  /** Hidden fields sent with the form. */
  hidden?: Record<string, string>;
  /** Translation namespace holding `errors.<code>` and `outcomes.<outcome>`. */
  messages: string;
  submitLabel: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
  inline?: boolean;
  children?: ReactNode;
}

/**
 * Small form around one server action: hidden fields, optional controls, a
 * submit button and the translated outcome. Used across the administration
 * area so each decision is one line in a page.
 */
export function ActionForm({
  action,
  hidden = {},
  messages,
  submitLabel,
  variant = "secondary",
  size = "sm",
  inline = true,
  children,
}: ActionFormProps) {
  const t = useTranslations(messages);
  const [state, formAction, pending] = useActionState(action, idle);
  const error = formError(state);

  return (
    <form action={formAction} className={inline ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-3"}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {submitLabel}
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-semibold text-danger">
          {t(`errors.${error}`)}
        </span>
      ) : null}
      {state.status === "ok" && state.outcome ? (
        <span role="status" className="text-xs font-semibold text-accent">
          {t(`outcomes.${state.outcome}`)}
        </span>
      ) : null}
    </form>
  );
}
