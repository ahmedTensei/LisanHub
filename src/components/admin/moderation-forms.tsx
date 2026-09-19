"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { moderateContent } from "@/server/actions/admin";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Field, inputClass } from "@/components/ui/field";
import { formError } from "@/components/forms/form-state";

/**
 * Decision R17: hiding published content asks for a reason the owner will
 * read, behind a second confirmation like every account change (decision R6);
 * restoring it is one confirmed click.
 */
export function ModerateContentForm({ itemId, status }: { itemId: string; status: string }) {
  const locale = useLocale();
  const t = useTranslations("admin.content.moderate");
  const tAdmin = useTranslations("admin");
  const [state, action, pending] = useActionState(moderateContent.bind(null, locale), idle);
  const error = formError(state);
  const hide = status === "published";
  if (!hide && status !== "hidden") return <p className="text-sm text-ink-muted">{t("notApplicable")}</p>;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="item" value={itemId} />
      <input type="hidden" name="hide" value={hide ? "true" : "false"} />
      {error ? <Alert tone="error">{tAdmin(`errors.${error}`)}</Alert> : null}
      {state.status === "ok" && state.outcome ? (
        <Alert tone="success">{tAdmin(`outcomes.${state.outcome}`)}</Alert>
      ) : null}
      {hide ? (
        <Field id="note" label={t("reason")} hint={t("reasonHint")}>
          <textarea
            id="note"
            name="note"
            className={`${inputClass} h-auto min-h-20 py-2`}
            dir="auto"
            maxLength={500}
            required
          />
        </Field>
      ) : null}
      <div>
        <ConfirmSubmit
          key={state.status === "ok" ? "done" : "idle"}
          label={hide ? t("hide") : t("restore")}
          question={hide ? t("hideQuestion") : t("restoreQuestion")}
          variant={hide ? "danger" : "primary"}
          pending={pending}
        />
      </div>
    </form>
  );
}
