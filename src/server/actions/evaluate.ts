"use server";

import { parseEvaluateInput } from "@/modules/player/evaluate-input";
import { evaluateItem } from "@/modules/plugins/evaluate";
import { getSession } from "@/server/actor";
import { canReadItem, loadPackage } from "@/server/packages/store";
import { getContentVersion } from "@/server/queries/content";
import { getPluginVersion, playabilityOf } from "@/server/queries/plugins";

/**
 * The authoritative score (ADR 0006 §9): recomputed here from the stored
 * package and the learner's answer with the platform's reference evaluators.
 * The frame's own result never reaches this function — the input schema has
 * no field for it. Nothing is stored in S2; progress arrives with S3.
 */

export type EvaluateOutcome =
  | { ok: true; correct: boolean; score: number; expected: unknown; displayOnly?: false }
  | { ok: true; displayOnly: true }
  | {
      ok: false;
      code:
        "invalid" | "result_field_forbidden" | "sign_in_required" | "not_found" | "plugin_paused" | "package_invalid";
    };

export async function evaluateAnswer(locale: string, raw: unknown): Promise<EvaluateOutcome> {
  const parsed = parseEvaluateInput(raw);
  if (!parsed.ok) return { ok: false, code: parsed.code };
  const { actor } = await getSession();
  if (actor.kind !== "user") return { ok: false, code: "sign_in_required" };

  const item = await canReadItem(parsed.input.packageId);
  if (!item) return { ok: false, code: "not_found" };

  let key: string | null;
  if (parsed.input.version === "draft") {
    key = item.ownerId === actor.userId || actor.adminRank !== null ? item.packageKey : null;
  } else {
    key = (await getContentVersion(parsed.input.packageId, parsed.input.version))?.packageKey ?? null;
  }
  if (!key) return { ok: false, code: "not_found" };

  const loaded = await loadPackage(key, parsed.input.version === "draft" ? "draft" : "publish");
  if (!loaded.ok) return { ok: false, code: loaded.reason === "invalid" ? "package_invalid" : "not_found" };

  const plugin = loaded.pluginVersionId ? await getPluginVersion(loaded.pluginVersionId) : null;
  if (!plugin || !playabilityOf(plugin, locale).ok) return { ok: false, code: "plugin_paused" };

  const entry = loaded.package.content.items.find((i) => i.item_id === parsed.input.itemId);
  const activity = entry ? plugin.definition.activities.find((a) => a.id === entry.activity) : undefined;
  if (!entry || !activity) return { ok: false, code: "not_found" };

  let evaluation;
  try {
    evaluation = evaluateItem(activity, entry, parsed.input.answer);
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (!evaluation) return { ok: true, displayOnly: true };
  return { ok: true, correct: evaluation.correct, score: evaluation.score, expected: evaluation.expected };
}
