import type { ExerciseAnswer } from "@/modules/exercises/definitions";
import { SELF_RATINGS, type SelfRating } from "@/modules/exercises/definitions";
import type { ContentItem, PluginActivity } from "@/modules/plugins/contract";
import { FIELD_VALUE_SCHEMAS, type PluginField } from "@/modules/plugins/fields";
import type { PlayerStringKey } from "@/modules/player/bridge";

/**
 * Generic rendering of one content item from its activity's field structure.
 * Every field type of the catalogue has one renderer here; a plugin brings no
 * rendering code of its own (decision R7). Only `textContent` and created
 * elements touch the DOM — never markup from the package.
 */

export type Strings = Partial<Record<PlayerStringKey, string>>;

export interface RenderContext {
  activity: PluginActivity;
  item: ContentItem;
  assetUrls: Record<string, string>;
  strings: Strings;
  /** Called when the learner rates a self-assessed card. */
  onSelfRating: (rating: SelfRating) => void;
}

export interface Rendered {
  root: HTMLElement;
  /** Reads the learner's current answer from the widgets, or null when nothing was answered. */
  collectAnswer: () => ExerciseAnswer | null;
  reset: () => void;
  reveal: () => void;
  hasRevealable: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function shuffle<T>(values: readonly T[]): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function labelOf(field: PluginField, locale: string): string {
  const label = field.label as Record<string, string>;
  return label[locale] || label.en || label.ar || field.key;
}

export function render(ctx: RenderContext, locale: string): Rendered {
  const { activity, item, strings } = ctx;
  const root = el("div", "player");
  const graded = activity.graded_field;
  const revealKeys = new Set(activity.scoring.evaluator === "self_assessment" ? activity.scoring.reveal_fields : []);
  const revealBox = el("div", "reveal");
  revealBox.hidden = true;
  const widgets: Widget[] = [];

  for (const field of activity.fields) {
    const value = item.fields[field.key];
    if (value === undefined) continue;
    const container = el("div", "field");
    if (field.type !== "image") container.appendChild(el("span", "label", labelOf(field, locale)));

    if (field.key === graded) {
      const widget = renderGraded(field, value, strings);
      widgets.push(widget);
      container.appendChild(widget.node);
    } else {
      container.appendChild(renderDisplay(field, value, ctx.assetUrls));
    }
    (revealKeys.has(field.key) ? revealBox : root).appendChild(container);
  }

  let ratingsBox: HTMLElement | null = null;
  if (revealKeys.size > 0) {
    root.appendChild(revealBox);
    ratingsBox = el("div", "ratings");
    ratingsBox.hidden = true;
    for (const rating of SELF_RATINGS) {
      const button = el("button", `button${rating === "again" ? "" : " secondary"}`, strings[rating] ?? rating);
      button.type = "button";
      button.addEventListener("click", () => ctx.onSelfRating(rating));
      ratingsBox.appendChild(button);
    }
    root.appendChild(ratingsBox);
  }

  return {
    root,
    hasRevealable: revealKeys.size > 0,
    collectAnswer: () => widgets[0]?.collect() ?? null,
    reset: () => {
      widgets.forEach((w) => w.reset());
      revealBox.hidden = true;
      if (ratingsBox) ratingsBox.hidden = true;
    },
    reveal: () => {
      revealBox.hidden = false;
      if (ratingsBox) ratingsBox.hidden = false;
    },
  };
}

function renderDisplay(field: PluginField, value: unknown, assetUrls: Record<string, string>): HTMLElement {
  switch (field.type) {
    case "short_text":
    case "long_text":
      return el("p", "text", typeof value === "string" ? value : "");
    case "item_list": {
      const list = el("ul", "list");
      for (const entry of Array.isArray(value) ? value : []) list.appendChild(el("li", undefined, String(entry)));
      return list;
    }
    case "image": {
      const parsed = FIELD_VALUE_SCHEMAS.image.safeParse(value);
      const img = el("img", "picture");
      if (parsed.success) {
        img.alt = parsed.data.alt;
        const url = assetUrls[parsed.data.asset];
        if (url) img.src = url;
      }
      return img;
    }
    case "single_choice":
    case "multiple_choice": {
      const list = el("ul", "list");
      const parsed = FIELD_VALUE_SCHEMAS.multiple_choice.safeParse(value);
      const single = FIELD_VALUE_SCHEMAS.single_choice.safeParse(value);
      const options = parsed.success ? parsed.data.options : single.success ? single.data.options : [];
      for (const option of options) list.appendChild(el("li", undefined, option.text));
      return list;
    }
    case "matching_pairs": {
      const list = el("ul", "list");
      const parsed = FIELD_VALUE_SCHEMAS.matching_pairs.safeParse(value);
      for (const pair of parsed.success ? parsed.data.pairs : [])
        list.appendChild(el("li", undefined, `${pair.left} — ${pair.right}`));
      return list;
    }
    case "ordering": {
      const parsed = FIELD_VALUE_SCHEMAS.ordering.safeParse(value);
      return el("p", "text", parsed.success ? parsed.data.tokens.join(" ") : "");
    }
    case "blank_in_text": {
      const parsed = FIELD_VALUE_SCHEMAS.blank_in_text.safeParse(value);
      const text = parsed.success
        ? parsed.data.template.replace(/\{\{(\d+)\}\}/g, (_, n) => parsed.data.blanks[Number(n)]?.[0] ?? "____")
        : "";
      return el("p", "text", text);
    }
  }
}

interface Widget {
  node: HTMLElement;
  collect: () => ExerciseAnswer | null;
  reset: () => void;
}

function renderGraded(field: PluginField, value: unknown, strings: Strings): Widget {
  switch (field.type) {
    case "single_choice":
    case "multiple_choice": {
      const multiple = field.type === "multiple_choice";
      const parsed = multiple
        ? FIELD_VALUE_SCHEMAS.multiple_choice.safeParse(value)
        : FIELD_VALUE_SCHEMAS.single_choice.safeParse(value);
      const options = parsed.success ? parsed.data.options : [];
      const node = el("div");
      node.appendChild(el("p", "hint", strings.chooseOne ?? ""));
      const list = el("ul", "options");
      const name = `choice-${field.key}`;
      const inputs: HTMLInputElement[] = [];
      for (const option of shuffle(options)) {
        const label = el("label", "option");
        const input = el("input");
        input.type = multiple ? "checkbox" : "radio";
        input.name = name;
        input.value = option.id;
        inputs.push(input);
        label.appendChild(input);
        label.appendChild(el("span", undefined, option.text));
        list.appendChild(label);
      }
      node.appendChild(list);
      return {
        node,
        collect: () => {
          const selected = inputs.filter((i) => i.checked).map((i) => i.value);
          return selected.length === 0 ? null : { type: "multiple_choice", selectedOptionIds: selected };
        },
        reset: () => inputs.forEach((i) => (i.checked = false)),
      };
    }

    case "blank_in_text": {
      const parsed = FIELD_VALUE_SCHEMAS.blank_in_text.safeParse(value);
      const node = el("div");
      node.appendChild(el("p", "hint", strings.blankHint ?? ""));
      const paragraph = el("p", "text");
      const inputs: HTMLInputElement[] = [];
      const template = parsed.success ? parsed.data.template : "";
      const parts = template.split(/(\{\{\d+\}\})/g);
      for (const part of parts) {
        const match = /^\{\{(\d+)\}\}$/.exec(part);
        if (match) {
          const input = el("input", "blank");
          input.type = "text";
          input.autocomplete = "off";
          input.dataset.index = match[1];
          inputs.push(input);
          paragraph.appendChild(input);
        } else if (part) {
          paragraph.appendChild(document.createTextNode(part));
        }
      }
      node.appendChild(paragraph);
      const ordered = [...inputs].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
      return {
        node,
        collect: () =>
          ordered.some((i) => i.value.trim() !== "")
            ? { type: "fill_blank", values: ordered.map((i) => i.value) }
            : null,
        reset: () => ordered.forEach((i) => (i.value = "")),
      };
    }

    case "matching_pairs": {
      const parsed = FIELD_VALUE_SCHEMAS.matching_pairs.safeParse(value);
      const pairs = parsed.success ? parsed.data.pairs : [];
      const node = el("div");
      node.appendChild(el("p", "hint", strings.matchHint ?? ""));
      const list = el("ul", "pairs");
      const selects: HTMLSelectElement[] = [];
      const rights = shuffle(pairs);
      for (const pair of pairs) {
        const row = el("li", "pair");
        row.appendChild(el("span", "text", pair.left));
        const select = el("select");
        select.dataset.pair = pair.id;
        select.appendChild(el("option", undefined, "—")).value = "";
        for (const right of rights) select.appendChild(el("option", undefined, right.right)).value = right.id;
        selects.push(select);
        row.appendChild(select);
        list.appendChild(row);
      }
      node.appendChild(list);
      return {
        node,
        collect: () => {
          const matches: Record<string, string> = {};
          for (const select of selects) if (select.value) matches[select.dataset.pair as string] = select.value;
          return Object.keys(matches).length === 0 ? null : { type: "matching", matches };
        },
        reset: () => selects.forEach((s) => (s.value = "")),
      };
    }

    case "ordering": {
      const parsed = FIELD_VALUE_SCHEMAS.ordering.safeParse(value);
      const tokens = parsed.success ? parsed.data.tokens : [];
      const node = el("div");
      node.appendChild(el("p", "hint", strings.orderHint ?? ""));
      const answer = el("div", "answer");
      const bank = el("div", "bank");
      node.appendChild(answer);
      node.appendChild(bank);
      const placed: string[] = [];
      const draw = () => {
        answer.replaceChildren();
        bank.replaceChildren();
        placed.forEach((token, i) => {
          const button = el("button", "token", token);
          button.type = "button";
          button.addEventListener("click", () => {
            placed.splice(i, 1);
            draw();
          });
          answer.appendChild(button);
        });
        const remaining = [...bankOrder];
        for (const token of placed) {
          const idx = remaining.indexOf(token);
          if (idx >= 0) remaining.splice(idx, 1);
        }
        for (const token of remaining) {
          const button = el("button", "token", token);
          button.type = "button";
          button.addEventListener("click", () => {
            placed.push(token);
            draw();
          });
          bank.appendChild(button);
        }
      };
      let bankOrder = shuffle(tokens);
      draw();
      return {
        node,
        collect: () => (placed.length === 0 ? null : { type: "word_order", tokens: [...placed] }),
        reset: () => {
          placed.length = 0;
          bankOrder = shuffle(tokens);
          draw();
        },
      };
    }

    default:
      return { node: renderDisplay(field, value, {}), collect: () => null, reset: () => undefined };
  }
}
