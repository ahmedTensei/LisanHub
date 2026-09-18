"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { AVATAR_CONTENT_TYPES, AVATAR_MAX_BYTES } from "@/modules/account/schemas";
import { removeAvatar, uploadAvatar } from "@/server/actions/account";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { fieldCode, formError } from "./form-state";

/** Profile picture: preview, confirmed upload, confirmed removal. */
export function AvatarForm({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  const locale = useLocale();
  const t = useTranslations("account.avatar");
  const tErrors = useTranslations("forms.errors");
  const tAccountErrors = useTranslations("account.errors");
  const [uploadState, upload, uploading] = useActionState(uploadAvatar.bind(null, locale), idle);
  const [removeState, remove, removing] = useActionState(() => removeAvatar(locale), idle);
  const [preview, setPreview] = useState<string | null>(null);
  const fieldError = fieldCode(uploadState, "avatar");
  const error = formError(uploadState) ?? formError(removeState);
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const shown = preview ?? avatarUrl;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="error">{tAccountErrors(error)}</Alert> : null}
      {uploadState.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}
      {removeState.status === "ok" && removeState.outcome ? <Alert tone="success">{t("removed")}</Alert> : null}
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-line bg-accent-soft">
          {shown ? (
            <Image src={shown} alt="" fill sizes="96px" unoptimized className="object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center text-3xl font-bold text-accent"
            >
              {initial}
            </span>
          )}
        </div>
        <form action={upload} className="flex flex-col gap-3">
          <label className="text-sm font-semibold" htmlFor="avatar">
            {t("choose")}
          </label>
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept={AVATAR_CONTENT_TYPES.join(",")}
            required
            className="text-sm text-ink-muted file:me-3 file:rounded-[var(--radius-control)] file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby="avatar-hint"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <p id="avatar-hint" className="text-xs text-ink-muted">
            {t("hint", { mb: Math.round(AVATAR_MAX_BYTES / 1024 / 1024) })}
          </p>
          {fieldError ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {tErrors(fieldError)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ConfirmSubmit label={t("upload")} question={t("confirmUpload")} size="sm" pending={uploading} />
          </div>
        </form>
      </div>
      {avatarUrl ? (
        <form action={remove} className="flex">
          <ConfirmSubmit
            label={t("remove")}
            question={t("confirmRemove")}
            variant="danger"
            size="sm"
            pending={removing}
          />
        </form>
      ) : null}
    </div>
  );
}
