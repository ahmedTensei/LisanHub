"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { idle } from "@/modules/account/forms";
import { AUTHORING_LOCALES, UI_LOCALE_NAMES, UI_LOCALES } from "@/modules/account/ui-locales";
import type { PluginActivity, PluginTemplate } from "@/modules/plugins/contract";
import { savePluginTemplate } from "@/server/actions/studio";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { formError } from "@/components/forms/form-state";

/**
 * A template is a skeleton: which activities a new package starts with and a
 * hint per field. There is no place here for a value, so a template can never
 * carry a sentence that looks like a lesson (decision R8).
 */

type Locales = Record<string, string>;
const emptyLocales = (): Locales => Object.fromEntries(UI_LOCALES.map((l) => [l, ""]));
const hasText = (l: Locales) => Object.values(l).some((v) => v.trim() !== "");
const small = `${inputClass} h-9`;

interface ItemDraft {
  activity: string;
  hints: Record<string, Locales>;
}

interface TemplateDraft {
  id: string;
  name: Locales;
  description: Locales;
  items: ItemDraft[];
}

function fromTemplate(template: PluginTemplate | null, firstActivity: string): TemplateDraft {
  if (!template)
    return {
      id: "",
      name: emptyLocales(),
      description: emptyLocales(),
      items: [{ activity: firstActivity, hints: {} }],
    };
  return {
    id: template.id,
    name: { ...emptyLocales(), ...template.name },
    description: { ...emptyLocales(), ...(template.description ?? {}) },
    items: template.items.map((i) => ({
      activity: i.activity,
      hints: Object.fromEntries(Object.entries(i.hints).map(([k, v]) => [k, { ...emptyLocales(), ...v }])),
    })),
  };
}

function toPayload(d: TemplateDraft): unknown {
  return {
    id: d.id,
    name: d.name,
    ...(hasText(d.description) ? { description: d.description } : {}),
    items: d.items.map((i) => ({
      activity: i.activity,
      hints: Object.fromEntries(Object.entries(i.hints).filter(([, v]) => hasText(v))),
    })),
  };
}

export function TemplateEditor({
  pluginRowId,
  activities,
  template,
}: {
  pluginRowId: string;
  activities: PluginActivity[];
  template: PluginTemplate | null;
}) {
  const locale = useLocale();
  const t = useTranslations("studio.template");
  const tErrors = useTranslations("studio.errors");
  const [draft, setDraft] = useState<TemplateDraft>(() => fromTemplate(template, activities[0]?.id ?? ""));
  const [state, action, pending] = useActionState(savePluginTemplate.bind(null, locale), idle);
  const error = formError(state);

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setDraft({ ...draft, items: draft.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= draft.items.length) return;
    const items = [...draft.items];
    [items[i], items[j]] = [items[j], items[i]];
    setDraft({ ...draft, items });
  };

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={pluginRowId} />
      <input type="hidden" name="original" value={template?.id ?? ""} />
      <input type="hidden" name="payload" value={JSON.stringify(toPayload(draft))} />
      {error ? <Alert tone="error">{tErrors.has(error) ? tErrors(error) : tErrors("unexpected")}</Alert> : null}
      {state.status === "ok" ? <Alert tone="success">{t("saved")}</Alert> : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("id")}
          <input
            className={`${inputClass} field-ltr`}
            value={draft.id}
            onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            placeholder="starter"
          />
        </label>
        <div />
        {AUTHORING_LOCALES.map((l) => (
          <label key={l} className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>
              {t("name")} — {UI_LOCALE_NAMES[l]}
              {l === "en" ? null : <span className="ms-1 font-normal text-ink-muted">({t("optional")})</span>}
            </span>
            <input
              className={inputClass}
              dir="auto"
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
              dir="auto"
              value={draft.description[l]}
              onChange={(e) => setDraft({ ...draft, description: { ...draft.description, [l]: e.target.value } })}
            />
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold">{t("itemsTitle")}</h3>
        <p className="text-sm text-ink-muted">{t("itemsLede")}</p>
        <ol className="flex flex-col gap-3">
          {draft.items.map((item, i) => {
            const activity = activities.find((a) => a.id === item.activity);
            return (
              <li key={i} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-paper p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-ink-muted">{t("item", { n: i + 1 })}</span>
                  <select
                    className={`${small} w-auto`}
                    value={item.activity}
                    onChange={(e) => setItem(i, { activity: e.target.value, hints: {} })}
                    aria-label={t("activity")}
                  >
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id}
                      </option>
                    ))}
                  </select>
                  <div className="ms-auto flex gap-1">
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
                      disabled={i === draft.items.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={draft.items.length === 1}
                      onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                    >
                      {t("removeItem")}
                    </Button>
                  </div>
                </div>
                {activity ? (
                  <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                    {activity.fields.map((field) => (
                      <div key={field.key} className="contents">
                        <span className="field-ltr self-center text-xs text-ink-muted">{field.key}</span>
                        <div className="grid gap-1 sm:grid-cols-3">
                          {AUTHORING_LOCALES.map((l) => (
                            <input
                              key={l}
                              className={small}
                              dir="auto"
                              placeholder={`${t("hint")} — ${UI_LOCALE_NAMES[l]}`}
                              aria-label={`${field.key} — ${t("hint")} — ${UI_LOCALE_NAMES[l]}`}
                              value={item.hints[field.key]?.[l] ?? ""}
                              onChange={(e) =>
                                setItem(i, {
                                  hints: {
                                    ...item.hints,
                                    [field.key]: {
                                      ...emptyLocales(),
                                      ...(item.hints[field.key] ?? {}),
                                      [l]: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setDraft({ ...draft, items: [...draft.items, { activity: activities[0]?.id ?? "", hints: {} }] })
            }
          >
            {t("addItem")}
          </Button>
        </div>
      </section>

      <div>
        <Button type="submit" disabled={pending || activities.length === 0}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
