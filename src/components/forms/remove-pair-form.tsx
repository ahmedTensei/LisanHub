"use client";

import { ConfirmSubmit } from "@/components/ui/confirm-submit";

/** Removing a language pair asks first, like every other change to the account. */
export function RemovePairForm({
  action,
  id,
  label,
  question,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  label: string;
  question: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label={label} question={question} variant="danger" size="sm" />
    </form>
  );
}
