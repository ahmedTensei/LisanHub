"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UiLocale } from "@/modules/account/ui-locales";
import type { ExerciseAnswer } from "@/modules/exercises/definitions";
import type { ContentItem, PluginDefinition } from "@/modules/plugins/contract";
import { generateAuthoringFields } from "@/modules/plugins/generate";
import { ItemForm } from "@/components/editor/item-form";
import { PlayerFrame } from "@/components/player/player-frame";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

/**
 * Studio preview: a throwaway item filled in the browser and rendered in the
 * same sandboxed player learners will use. Nothing here touches the server —
 * no action, no upload; pictures stay in memory as Blobs (ADR 0006 §12).
 */
export function StudioPreview({
  definition,
  sha256,
  playerUrl,
}: {
  definition: PluginDefinition;
  sha256: string;
  playerUrl: string;
}) {
  const locale = useLocale() as UiLocale;
  const t = useTranslations("studio.preview");
  const authoring = generateAuthoringFields(definition.activities);
  const [activityId, setActivityId] = useState(definition.activities[0]?.id ?? "");
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [images, setImages] = useState<Record<string, File>>({});
  const [rendered, setRendered] = useState<{ item: ContentItem; activity: string; nonce: number } | null>(null);
  const [instant, setInstant] = useState<{ correct: boolean; score: number } | null>(null);
  const [answer, setAnswer] = useState<ExerciseAnswer | null>(null);
  const activity = authoring.find((a) => a.activity === activityId) ?? authoring[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("activity")}
          <select
            className={inputClass}
            value={activityId}
            onChange={(e) => {
              setActivityId(e.target.value);
              setFields({});
            }}
          >
            {authoring.map((a) => (
              <option key={a.activity} value={a.activity}>
                {a.name[locale] || a.activity}
              </option>
            ))}
          </select>
        </label>
        {activity ? (
          <ItemForm
            activity={activity}
            locale={locale}
            value={fields}
            onChange={setFields}
            idPrefix="preview"
            onLocalImage={(file) => {
              const path = `assets/preview-${Object.keys(images).length + 1}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg"}`;
              setImages({ ...images, [path]: file });
              return path;
            }}
          />
        ) : null}
        <div>
          <Button
            type="button"
            disabled={!activity}
            onClick={() => {
              if (!activity) return;
              setInstant(null);
              setAnswer(null);
              setRendered({
                item: { item_id: "preview-0001", activity: activity.activity, fields },
                activity: activity.activity,
                nonce: Date.now(),
              });
            }}
          >
            {t("render")}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-ink-muted">{t("frameTitle")}</h3>
        {rendered ? (
          <PlayerFrame
            key={rendered.nonce}
            playerUrl={playerUrl}
            definition={definition}
            definitionSha256={sha256}
            activity={rendered.activity}
            item={rendered.item}
            assets={images}
            onInstantResult={setInstant}
            onAnswer={setAnswer}
          />
        ) : (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            {t("empty")}
          </p>
        )}
        {instant ? (
          <p className="text-sm">
            {t("instant")}: <strong>{instant.correct ? t("correct") : t("incorrect")}</strong> ·{" "}
            {Math.round(instant.score * 100)}%<span className="block text-xs text-ink-muted">{t("instantNote")}</span>
          </p>
        ) : null}
        {answer ? (
          <details className="text-xs text-ink-muted">
            <summary>{t("answerReceived")}</summary>
            <pre className="field-ltr mt-2 overflow-auto rounded bg-paper p-2">{JSON.stringify(answer, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
