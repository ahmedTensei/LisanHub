"use client";

import { useState, type InputHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { inputClass } from "./field";
import { EyeIcon, EyeOffIcon } from "./icons";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/** Password field with a show/hide toggle; the value is always left-to-right. */
export function PasswordInput(props: Props) {
  const t = useTranslations("forms");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative" dir="ltr">
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} field-ltr pe-12`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-[var(--radius-control)] text-ink-muted hover:text-accent-strong"
      >
        {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  );
}
