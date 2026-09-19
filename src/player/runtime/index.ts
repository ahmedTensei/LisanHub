import type { ExerciseAnswer, SelfRating } from "@/modules/exercises/definitions";
import { PlatformToPlayer, type PlayerToPlatform } from "@/modules/player/bridge";
import type { ContentItem, PluginActivity } from "@/modules/plugins/contract";
import { evaluateItem } from "@/modules/plugins/evaluate";
import { sha256OfJson } from "@/modules/plugins/hash";
import { render, type Rendered, type Strings } from "./render";

/**
 * The player: one sandboxed document per activity (ADR 0006 §5 and §9).
 * It knows nothing about who is learning. It receives a plugin definition
 * (verified against its pinned hash), one item and its assets as bytes, shows
 * them, and reports the learner's answer plus an instant score for display.
 * The authoritative score is computed by the platform's server.
 */

const parentOrigin = new URLSearchParams(location.search).get("parent") ?? "";
const root = document.getElementById("root") as HTMLElement;

let current: { rendered: Rendered; check: () => void; objectUrls: string[]; strings: Strings } | null = null;

function post(message: PlayerToPlatform) {
  if (parentOrigin && window.parent !== window) window.parent.postMessage(message, parentOrigin);
}

function fail(
  code: "invalid_message" | "definition_hash_mismatch" | "activity_missing" | "asset_missing" | "render_failed",
  detail?: string,
) {
  root.replaceChildren();
  const box = document.createElement("div");
  box.className = "error";
  box.textContent = detail ?? code;
  root.appendChild(box);
  post({ type: "error", code, detail });
}

function clear() {
  if (current) for (const url of current.objectUrls) URL.revokeObjectURL(url);
  current = null;
  root.replaceChildren();
}

/**
 * The evaluator names the expected answer the way it stores it; a learner is
 * shown texts, never identifiers. Choice answers arrive as option ids and are
 * mapped back to the option texts of the graded field.
 */
function formatExpected(activity: PluginActivity, item: ContentItem, expected: unknown): string {
  if (typeof expected === "string") return expected;
  if (Array.isArray(expected)) {
    const graded = item.fields[activity.graded_field ?? ""];
    const options =
      graded && typeof graded === "object" && Array.isArray((graded as { options?: unknown }).options)
        ? (graded as { options: { id: string; text: string }[] }).options
        : [];
    return expected.map((entry) => options.find((option) => option.id === entry)?.text ?? String(entry)).join("، ");
  }
  if (expected && typeof expected === "object") {
    return Object.entries(expected as Record<string, string>)
      .map(([left, right]) => `${left} ← ${right}`)
      .join("\n");
  }
  return "";
}

function handle(message: PlatformToPlayer) {
  if (message.type === "reset") {
    current?.rendered.reset();
    document.querySelector(".feedback")?.remove();
    return;
  }
  if (message.type === "check") {
    current?.check();
    return;
  }

  clear();
  const { plugin, activity: activityId, item, assets, strings } = message;
  if (sha256OfJson(plugin.definition) !== plugin.sha256) return fail("definition_hash_mismatch");
  const activity = plugin.definition.activities.find((a) => a.id === activityId);
  if (!activity) return fail("activity_missing", activityId);

  document.documentElement.lang = message.locale;
  document.documentElement.dir = message.dir;

  const objectUrls: string[] = [];
  const assetUrls: Record<string, string> = {};
  for (const [path, blob] of Object.entries(assets)) {
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    assetUrls[path] = url;
  }

  const showResult = (answer: ExerciseAnswer) => {
    document.querySelector(".feedback")?.remove();
    let evaluation;
    try {
      evaluation = evaluateItem(activity, item, answer);
    } catch (error) {
      return fail("render_failed", error instanceof Error ? error.message : "evaluation");
    }
    post({ type: "answer", answer });
    if (!evaluation) return;
    post({ type: "result", correct: evaluation.correct, score: evaluation.score, expected: evaluation.expected });
    const box = document.createElement("div");
    box.className = `feedback ${evaluation.correct ? "ok" : "bad"}`;
    box.setAttribute("role", "status");
    box.textContent = evaluation.correct ? (strings.correct ?? "✓") : (strings.incorrect ?? "✗");
    if (!evaluation.correct && activity.scoring.evaluator !== "self_assessment") {
      const expected = document.createElement("span");
      expected.className = "expected";
      expected.textContent = `${strings.expected ?? ""} ${formatExpected(activity, item, evaluation.expected)}`.trim();
      box.appendChild(expected);
    }
    root.appendChild(box);
  };

  let rendered: Rendered;
  try {
    rendered = render(
      {
        activity,
        item,
        assetUrls,
        strings,
        onSelfRating: (rating: SelfRating) => showResult({ type: "self_assessment", rating }),
      },
      message.locale,
    );
  } catch (error) {
    return fail("render_failed", error instanceof Error ? error.message : "render");
  }
  root.appendChild(rendered.root);

  const check = () => {
    const answer = rendered.collectAnswer();
    if (answer) showResult(answer);
  };

  const actions = document.createElement("div");
  actions.className = "actions";
  if (rendered.hasRevealable) {
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "button";
    reveal.textContent = strings.reveal ?? "…";
    reveal.addEventListener("click", () => {
      rendered.reveal();
      reveal.disabled = true;
    });
    actions.appendChild(reveal);
  } else if (activity.scoring.evaluator !== "none") {
    const checkButton = document.createElement("button");
    checkButton.type = "button";
    checkButton.className = "button";
    checkButton.textContent = strings.check ?? "✓";
    checkButton.addEventListener("click", check);
    actions.appendChild(checkButton);
  }
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "button secondary";
  resetButton.textContent = strings.reset ?? "↺";
  resetButton.addEventListener("click", () => handle({ type: "reset" }));
  actions.appendChild(resetButton);
  root.appendChild(actions);

  current = { rendered, check, objectUrls, strings };
}

window.addEventListener("message", (event) => {
  if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
  const parsed = PlatformToPlayer.safeParse(event.data);
  if (!parsed.success) return fail("invalid_message");
  handle(parsed.data);
});

const observer = new ResizeObserver(() =>
  post({ type: "height", px: Math.ceil(document.documentElement.scrollHeight) }),
);
observer.observe(document.body);

post({ type: "ready" });
