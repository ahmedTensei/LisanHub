"use client";

import { useTranslations } from "next-intl";
import type { UiLocale } from "@/modules/account/ui-locales";
import { countBlanks, emptyFieldValue, type FieldType, type PluginField } from "@/modules/plugins/fields";
import type { AuthoringActivity, AuthoringField } from "@/modules/plugins/generate";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

/**
 * The editor of one content item, generated from a plugin's authoring fields
 * (ADR 0006 §12). One sub-editor per field type of the catalogue; a plugin
 * never brings its own form. Controlled: the parent owns the item's values.
 */

export interface AssetOption {
  path: string;
  label: string;
}

export interface ItemFormProps {
  activity: AuthoringActivity;
  locale: UiLocale;
  value: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
  /** Package assets an image field may point at. */
  assets?: AssetOption[];
  /** Studio preview: an image is picked from the device and never uploaded. */
  onLocalImage?: (file: File) => string;
  /** Validation codes per field key (`forms.errors.*`). */
  errors?: Record<string, string>;
  idPrefix?: string;
}

const textarea = `${inputClass} h-auto min-h-24 py-2`;
const small = `${inputClass} h-9`;

function localized(text: Record<string, string> | undefined, locale: UiLocale): string {
  if (!text) return "";
  return text[locale] || text.en || text.ar || text.fr || "";
}

function nextId(existing: readonly { id: string }[]): string {
  let n = existing.length + 1;
  while (existing.some((o) => o.id === `o${n}`)) n += 1;
  return `o${n}`;
}

export function ItemForm({
  activity,
  locale,
  value,
  onChange,
  assets = [],
  onLocalImage,
  errors = {},
  idPrefix = "item",
}: ItemFormProps) {
  const t = useTranslations("editor.item");
  const tErrors = useTranslations("forms.errors");
  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-col gap-5">
      {activity.fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const current = value[field.key] ?? emptyFieldValue(toPluginField(field));
        const error = errors[field.key];
        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-semibold">
              {localized(field.label, locale)}
              {field.required ? null : (
                <span className="ms-2 text-xs font-normal text-ink-muted">({t("optional")})</span>
              )}
            </label>
            {field.hint ? <p className="text-xs text-ink-muted">{localized(field.hint, locale)}</p> : null}
            <FieldEditor
              id={id}
              field={field}
              value={current}
              onChange={(next) => set(field.key, next)}
              assets={assets}
              onLocalImage={onLocalImage}
              t={t}
            />
            {error ? (
              <p role="alert" className="text-xs font-semibold text-danger">
                {tErrors.has(error) ? tErrors(error) : error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Rebuilds the catalogue field from an authoring descriptor (same data, flattened options). */
export function toPluginField(field: AuthoringField): PluginField {
  return {
    key: field.key,
    type: field.type,
    label: field.label,
    hint: field.hint,
    required: field.required,
    ...field.options,
  } as PluginField;
}

type Translate = ReturnType<typeof useTranslations<"editor.item">>;

interface FieldEditorProps {
  id: string;
  field: AuthoringField;
  value: unknown;
  onChange: (next: unknown) => void;
  assets: AssetOption[];
  onLocalImage?: (file: File) => string;
  t: Translate;
}

function FieldEditor({ id, field, value, onChange, assets, onLocalImage, t }: FieldEditorProps) {
  switch (field.type as FieldType) {
    case "short_text":
      return (
        <input
          id={id}
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          dir="auto"
        />
      );

    case "long_text":
      return (
        <textarea
          id={id}
          className={textarea}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          dir="auto"
        />
      );

    case "item_list": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return (
        <ListEditor
          id={id}
          items={items}
          onChange={onChange}
          render={(item, i) => (
            <input
              className={small}
              value={item}
              dir="auto"
              aria-label={t("entry", { n: i + 1 })}
              onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            />
          )}
          create={() => ""}
          t={t}
        />
      );
    }

    case "single_choice":
    case "multiple_choice": {
      const multiple = field.type === "multiple_choice";
      const v = (value ?? emptyFieldValue(toPluginField(field))) as {
        options: { id: string; text: string }[];
        correct: string | string[];
      };
      const correct = new Set(Array.isArray(v.correct) ? v.correct : v.correct ? [v.correct] : []);
      const setCorrect = (next: Set<string>) =>
        onChange({ ...v, correct: multiple ? [...next] : ([...next][0] ?? "") });
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">{multiple ? t("markCorrectMany") : t("markCorrectOne")}</p>
          <ListEditor
            id={id}
            items={v.options}
            onChange={(options) =>
              onChange({
                ...v,
                options,
                correct: multiple
                  ? [...correct].filter((c) => options.some((o) => o.id === c))
                  : options.some((o) => o.id === v.correct)
                    ? v.correct
                    : "",
              })
            }
            render={(option, i) => (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`${id}-correct`}
                  checked={correct.has(option.id)}
                  aria-label={t("correct")}
                  className="size-4 accent-accent"
                  onChange={(e) => {
                    const next = multiple ? new Set(correct) : new Set<string>();
                    if (e.target.checked) next.add(option.id);
                    else next.delete(option.id);
                    setCorrect(next);
                  }}
                />
                <input
                  className={small}
                  value={option.text}
                  dir="auto"
                  aria-label={t("option", { n: i + 1 })}
                  onChange={(e) =>
                    onChange({ ...v, options: v.options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)) })
                  }
                />
              </div>
            )}
            create={() => ({ id: nextId(v.options), text: "" })}
            t={t}
          />
        </div>
      );
    }

    case "matching_pairs": {
      const v = (value ?? { pairs: [] }) as { pairs: { id: string; left: string; right: string }[] };
      return (
        <ListEditor
          id={id}
          items={v.pairs}
          onChange={(pairs) => onChange({ pairs })}
          render={(pair, i) => (
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input
                className={small}
                value={pair.left}
                dir="auto"
                aria-label={t("left", { n: i + 1 })}
                onChange={(e) =>
                  onChange({ pairs: v.pairs.map((p, j) => (j === i ? { ...p, left: e.target.value } : p)) })
                }
              />
              <input
                className={small}
                value={pair.right}
                dir="auto"
                aria-label={t("right", { n: i + 1 })}
                onChange={(e) =>
                  onChange({ pairs: v.pairs.map((p, j) => (j === i ? { ...p, right: e.target.value } : p)) })
                }
              />
            </div>
          )}
          create={() => ({ id: nextId(v.pairs), left: "", right: "" })}
          t={t}
        />
      );
    }

    case "ordering": {
      const v = (value ?? { tokens: [] }) as { tokens: string[] };
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">{t("orderingHint")}</p>
          <ListEditor
            id={id}
            items={v.tokens}
            onChange={(tokens) => onChange({ tokens })}
            render={(token, i) => (
              <input
                className={small}
                value={token}
                dir="auto"
                aria-label={t("token", { n: i + 1 })}
                onChange={(e) => onChange({ tokens: v.tokens.map((x, j) => (j === i ? e.target.value : x)) })}
              />
            )}
            create={() => ""}
            t={t}
          />
        </div>
      );
    }

    case "blank_in_text": {
      const v = (value ?? { template: "", blanks: [] }) as { template: string; blanks: string[][] };
      const count = countBlanks(v.template);
      const blanks = Array.from({ length: count }, (_, i) => v.blanks[i] ?? [""]);
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">{t("blankHint")}</p>
          <textarea
            id={id}
            className={textarea}
            value={v.template}
            dir="auto"
            onChange={(e) => {
              const template = e.target.value;
              const n = countBlanks(template);
              onChange({ template, blanks: Array.from({ length: n }, (_, i) => v.blanks[i] ?? [""]) });
            }}
          />
          {blanks.map((accepted, i) => (
            <label key={i} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 text-ink-muted">{t("blank", { n: i })}</span>
              <input
                className={small}
                value={accepted.join(" | ")}
                dir="auto"
                placeholder={t("blankAccepted")}
                onChange={(e) => {
                  const next = [...blanks];
                  next[i] = e.target.value.split("|").map((s) => s.trim());
                  onChange({ template: v.template, blanks: next });
                }}
              />
            </label>
          ))}
        </div>
      );
    }

    case "image": {
      const v = (value ?? { asset: "", alt: "" }) as { asset: string; alt: string };
      return (
        <div className="flex flex-col gap-2">
          {onLocalImage ? (
            <input
              id={id}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange({ ...v, asset: onLocalImage(file) });
              }}
            />
          ) : (
            <select
              id={id}
              className={small}
              value={v.asset}
              onChange={(e) => onChange({ ...v, asset: e.target.value })}
            >
              <option value="">{t("noImage")}</option>
              {assets.map((a) => (
                <option key={a.path} value={a.path}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
          {v.asset ? <p className="text-xs text-ink-muted field-ltr">{v.asset}</p> : null}
          <input
            className={small}
            value={v.alt}
            dir="auto"
            placeholder={t("altText")}
            aria-label={t("altText")}
            onChange={(e) => onChange({ ...v, alt: e.target.value })}
          />
        </div>
      );
    }
  }
}

interface ListEditorProps<T> {
  id: string;
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number) => React.ReactNode;
  create: () => T;
  t: Translate;
}

/** Add, remove and reorder with buttons that work from the keyboard. */
function ListEditor<T>({ id, items, onChange, render, create, t }: ListEditorProps<T>) {
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2" aria-labelledby={id}>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            {render(item, i)}
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={t("moveUp")}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label={t("moveDown")}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                aria-label={t("remove")}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...items, create()])}>
          {t("add")}
        </Button>
      </div>
    </div>
  );
}
