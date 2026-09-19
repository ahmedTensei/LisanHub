"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { AUTHORING_LOCALES, UI_LOCALE_DIRECTIONS, UI_LOCALE_NAMES, UI_LOCALES } from "@/modules/account/ui-locales";
import { LANGUAGE_SKILLS } from "@/modules/content/levels";
import type { PluginActivity } from "@/modules/plugins/contract";
import { EVALUATOR_BY_FIELD_TYPE, FIELD_TYPES, isGradableFieldType, type FieldType } from "@/modules/plugins/fields";
import { savePluginActivity } from "@/server/actions/studio";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formError } from "@/components/forms/form-state";

/**
 * Composes one activity of a plugin from the field-type catalogue, without
 * code: the structure of an item, which field is graded, which reference
 * evaluator scores it and with which options. The schema and the editor
 * fields are generated from this on the server.
 */

const small = `${inputClass} h-9`;
const OPTION_KEYS: Record<FieldType, string[]> = {
  short_text: ["max_length"],
  long_text: ["max_length"],
  item_list: ["min_items", "max_items"],
  single_choice: ["min_options", "max_options"],
  multiple_choice: ["min_options", "max_options"],
  matching_pairs: ["min_pairs", "max_pairs"],
  ordering: ["min_tokens", "max_tokens"],
  blank_in_text: ["max_blanks"],
  image: [],
};
const DEFAULT_OPTIONS: Record<FieldType, Record<string, number>> = {
  short_text: { max_length: 200 },
  long_text: { max_length: 5000 },
  item_list: { min_items: 1, max_items: 50 },
  single_choice: { min_options: 2, max_options: 6 },
  multiple_choice: { min_options: 2, max_options: 8 },
  matching_pairs: { min_pairs: 2, max_pairs: 10 },
  ordering: { min_tokens: 2, max_tokens: 20 },
  blank_in_text: { max_blanks: 5 },
  image: {},
};

type Locales = Record<string, string>;
const emptyLocales = (): Locales => Object.fromEntries(UI_LOCALES.map((l) => [l, ""]));

interface FieldDraft {
  key: string;
  type: FieldType;
  label: Locales;
  hint: Locales;
  required: boolean;
  options: Record<string, number>;
}

interface ActivityDraft {
  id: string;
  name: Locales;
  description: Locales;
  skill: (typeof LANGUAGE_SKILLS)[number];
  fields: FieldDraft[];
  graded_field: string;
  ignore_case: boolean;
  ignore_arabic_diacritics: boolean;
  reveal_fields: string[];
  display_only: boolean;
}

function fromActivity(activity: PluginActivity | null): ActivityDraft {
  if (!activity) {
    return {
      id: "",
      name: emptyLocales(),
      description: emptyLocales(),
      skill: "reading",
      fields: [],
      graded_field: "",
      ignore_case: true,
      ignore_arabic_diacritics: false,
      reveal_fields: [],
      display_only: false,
    };
  }
  const scoring = activity.scoring;
  return {
    id: activity.id,
    name: { ...emptyLocales(), ...activity.name },
    description: { ...emptyLocales(), ...(activity.description ?? {}) },
    skill: activity.skill,
    fields: activity.fields.map((f) => {
      const { key, type, label, hint, required, ...options } = f;
      return {
        key,
        type,
        label: { ...emptyLocales(), ...label },
        hint: { ...emptyLocales(), ...(hint ?? {}) },
        required,
        options: options as Record<string, number>,
      };
    }),
    graded_field: activity.graded_field ?? "",
    ignore_case: scoring.evaluator === "fill_blank" ? scoring.ignore_case : true,
    ignore_arabic_diacritics: scoring.evaluator === "fill_blank" ? scoring.ignore_arabic_diacritics : false,
    reveal_fields: scoring.evaluator === "self_assessment" ? scoring.reveal_fields : [],
    display_only: scoring.evaluator === "none",
  };
}

const hasText = (l: Locales) => Object.values(l).some((v) => v.trim() !== "");

/** The contract shape the server validates; nothing is trusted from here. */
function toPayload(d: ActivityDraft): unknown {
  const graded = d.fields.find((f) => f.key === d.graded_field && isGradableFieldType(f.type));
  const scoring = graded
    ? graded.type === "blank_in_text"
      ? { evaluator: "fill_blank", ignore_case: d.ignore_case, ignore_arabic_diacritics: d.ignore_arabic_diacritics }
      : { evaluator: EVALUATOR_BY_FIELD_TYPE[graded.type] }
    : d.display_only || d.reveal_fields.length === 0
      ? { evaluator: "none" }
      : { evaluator: "self_assessment", reveal_fields: d.reveal_fields };
  return {
    id: d.id,
    name: d.name,
    ...(hasText(d.description) ? { description: d.description } : {}),
    skill: d.skill,
    fields: d.fields.map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      ...(hasText(f.hint) ? { hint: f.hint } : {}),
      required: f.required,
      ...f.options,
    })),
    graded_field: graded ? graded.key : null,
    scoring,
  };
}

export function ActivityEditor({ pluginRowId, activity }: { pluginRowId: string; activity: PluginActivity | null }) {
  const locale = useLocale();
  const t = useTranslations("studio.activity");
  const tTypes = useTranslations("studio.fieldTypes");
  const tSkills = useTranslations("studio.skills");
  const tErrors = useTranslations("studio.errors");
  const [draft, setDraft] = useState<ActivityDraft>(() => fromActivity(activity));
  const [state, action, pending] = useActionState(savePluginActivity.bind(null, locale), idle);
  const error = formError(state);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const setField = (i: number, patch: Partial<FieldDraft>) =>
    setDraft({ ...draft, fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const moveField = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= draft.fields.length) return;
    const fields = [...draft.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    setDraft({ ...draft, fields });
  };
  const gradable = draft.fields.filter((f) => isGradableFieldType(f.type));
  const gradedField = gradable.find((f) => f.key === draft.graded_field);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={pluginRowId} />
      <input type="hidden" name="original" value={activity?.id ?? ""} />
      <input type="hidden" name="payload" value={JSON.stringify(toPayload(draft))} />
      {error ? (
        <Alert tone="error">
          {tErrors.has(error) ? tErrors(error) : tErrors("unexpected")}
          {Object.keys(fieldErrors).length > 0 ? (
            <ul className="list-disc ps-5 text-xs">
              {Object.entries(fieldErrors).map(([path, code]) => (
                <li key={path} className="field-ltr">
                  {path}: {code}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      {state.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("id")}
          <input
            className={`${inputClass} field-ltr`}
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            placeholder="fill-dialogue"
          />
          <span className="text-xs font-normal text-ink-muted">{t("idHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("skill")}
          <select
            className={inputClass}
            value={draft.skill}
            onChange={(e) => setDraft({ ...draft, skill: e.target.value as ActivityDraft["skill"] })}
          >
            {LANGUAGE_SKILLS.map((s) => (
              <option key={s} value={s}>
                {tSkills(s)}
              </option>
            ))}
          </select>
        </label>
        {AUTHORING_LOCALES.map((l) => (
          <label key={l} className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>
              {t("name")} — {UI_LOCALE_NAMES[l]}
              {l === "en" ? null : <span className="ms-1 font-normal text-ink-muted">({t("optional")})</span>}
            </span>
            <input
              className={inputClass}
              dir={UI_LOCALE_DIRECTIONS[l]}
              lang={l}
              required={l === "en"}
              value={draft.name[l]}
              onChange={(e) => setDraft({ ...draft, name: { ...draft.name, [l]: e.target.value } })}
            />
          </label>
        ))}
        {AUTHORING_LOCALES.map((l) => (
          <label key={l} className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>
              {t("description")} — {UI_LOCALE_NAMES[l]}
              {l === "en" ? null : <span className="ms-1 font-normal text-ink-muted">({t("optional")})</span>}
            </span>
            <input
              className={inputClass}
              dir={UI_LOCALE_DIRECTIONS[l]}
              lang={l}
              value={draft.description[l]}
              onChange={(e) => setDraft({ ...draft, description: { ...draft.description, [l]: e.target.value } })}
            />
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">{t("fieldsTitle")}</h3>
        <p className="text-sm text-ink-muted">{t("fieldsLede")}</p>
        {draft.fields.length === 0 ? <p className="text-sm text-ink-muted">{t("noFields")}</p> : null}
        <ul className="flex flex-col gap-3">
          {draft.fields.map((field, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                  {tTypes(field.type)}
                </span>
                <input
                  className={`${small} field-ltr w-48`}
                  value={field.key}
                  aria-label={t("fieldKey")}
                  placeholder="prompt"
                  onChange={(e) => setField(i, { key: e.target.value })}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={field.required}
                    onChange={(e) => setField(i, { required: e.target.checked })}
                  />
                  {t("required")}
                </label>
                <div className="ms-auto flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={t("moveUp")}
                    disabled={i === 0}
                    onClick={() => moveField(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={t("moveDown")}
                    disabled={i === draft.fields.length - 1}
                    onClick={() => moveField(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        fields: draft.fields.filter((_, j) => j !== i),
                        graded_field: draft.graded_field === field.key ? "" : draft.graded_field,
                        reveal_fields: draft.reveal_fields.filter((k) => k !== field.key),
                      })
                    }
                  >
                    {t("removeField")}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUTHORING_LOCALES.map((l) => (
                  <input
                    key={`label-${l}`}
                    className={small}
                    dir={UI_LOCALE_DIRECTIONS[l]}
                    lang={l}
                    required={l === "en"}
                    value={field.label[l]}
                    placeholder={`${t("label")} — ${UI_LOCALE_NAMES[l]}${l === "en" ? "" : ` (${t("optional")})`}`}
                    aria-label={`${t("label")} — ${UI_LOCALE_NAMES[l]}`}
                    onChange={(e) => setField(i, { label: { ...field.label, [l]: e.target.value } })}
                  />
                ))}
                {AUTHORING_LOCALES.map((l) => (
                  <input
                    key={`hint-${l}`}
                    className={small}
                    dir={UI_LOCALE_DIRECTIONS[l]}
                    lang={l}
                    value={field.hint[l]}
                    placeholder={`${t("hint")} — ${UI_LOCALE_NAMES[l]} (${t("optional")})`}
                    aria-label={`${t("hint")} — ${UI_LOCALE_NAMES[l]}`}
                    onChange={(e) => setField(i, { hint: { ...field.hint, [l]: e.target.value } })}
                  />
                ))}
              </div>
              {OPTION_KEYS[field.type].length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {OPTION_KEYS[field.type].map((option) => (
                    <label key={option} className="flex items-center gap-2 text-xs">
                      <span className="text-ink-muted">{t(`options.${option}`)}</span>
                      <input
                        type="number"
                        className={`${small} field-ltr w-24`}
                        value={field.options[option] ?? DEFAULT_OPTIONS[field.type][option]}
                        min={0}
                        onChange={(e) =>
                          setField(i, { options: { ...field.options, [option]: Number(e.target.value) } })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <AddField
            onAdd={(type) =>
              setDraft({
                ...draft,
                fields: [
                  ...draft.fields,
                  {
                    key: `${type.replace(/_/g, "-")}-${draft.fields.length + 1}`.replace(/-/g, "_"),
                    type,
                    label: emptyLocales(),
                    hint: emptyLocales(),
                    required: true,
                    options: { ...DEFAULT_OPTIONS[type] },
                  },
                ],
              })
            }
            label={t("addField")}
            tTypes={tTypes}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
        <h3 className="text-base font-bold">{t("scoringTitle")}</h3>
        <p className="text-sm text-ink-muted">{t("scoringLede")}</p>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("gradedField")}
          <select
            className={inputClass}
            value={draft.graded_field}
            onChange={(e) => setDraft({ ...draft, graded_field: e.target.value, display_only: false })}
          >
            <option value="">{t("noGradedField")}</option>
            {gradable.map((f) => (
              <option key={f.key} value={f.key}>
                {f.key} — {tTypes(f.type)}
              </option>
            ))}
          </select>
        </label>
        {gradedField ? (
          <p className="text-sm">
            {t("evaluator")}: <strong>{t(`evaluators.${EVALUATOR_BY_FIELD_TYPE[gradedField.type] ?? "none"}`)}</strong>
          </p>
        ) : null}
        {gradedField?.type === "blank_in_text" ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={draft.ignore_case}
                onChange={(e) => setDraft({ ...draft, ignore_case: e.target.checked })}
              />
              {t("ignoreCase")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={draft.ignore_arabic_diacritics}
                onChange={(e) => setDraft({ ...draft, ignore_arabic_diacritics: e.target.checked })}
              />
              {t("ignoreDiacritics")}
            </label>
          </div>
        ) : null}
        {!gradedField ? (
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="size-4 accent-accent"
                checked={!draft.display_only}
                onChange={() => setDraft({ ...draft, display_only: false })}
              />
              {t("selfAssessment")}
            </label>
            {!draft.display_only ? (
              <div className="ms-6 flex flex-col gap-1">
                <span className="text-xs text-ink-muted">{t("revealFields")}</span>
                {draft.fields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={draft.reveal_fields.includes(f.key)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          reveal_fields: e.target.checked
                            ? [...draft.reveal_fields, f.key]
                            : draft.reveal_fields.filter((k) => k !== f.key),
                        })
                      }
                    />
                    <span className="field-ltr">{f.key}</span>
                  </label>
                ))}
              </div>
            ) : null}
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="size-4 accent-accent"
                checked={draft.display_only}
                onChange={() => setDraft({ ...draft, display_only: true })}
              />
              {t("displayOnly")}
            </label>
          </div>
        ) : null}
      </section>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function AddField({
  onAdd,
  label,
  tTypes,
}: {
  onAdd: (type: FieldType) => void;
  label: string;
  tTypes: ReturnType<typeof useTranslations<"studio.fieldTypes">>;
}) {
  const [type, setType] = useState<FieldType>("short_text");
  return (
    <>
      <select
        className={`${small} w-auto`}
        value={type}
        onChange={(e) => setType(e.target.value as FieldType)}
        aria-label={label}
      >
        {FIELD_TYPES.map((ft) => (
          <option key={ft} value={ft}>
            {tTypes(ft)}
          </option>
        ))}
      </select>
      <Button type="button" variant="secondary" size="sm" onClick={() => onAdd(type)}>
        {label}
      </Button>
    </>
  );
}
