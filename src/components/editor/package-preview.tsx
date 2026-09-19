"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExerciseAnswer } from "@/modules/exercises/definitions";
import type { ContentItem, PluginDefinition } from "@/modules/plugins/contract";
import { evaluateAnswer, type EvaluateOutcome } from "@/server/actions/evaluate";
import { PlayerFrame } from "@/components/player/player-frame";
import { Button } from "@/components/ui/button";

/**
 * The learner's view of a package: one sandboxed frame per item, with the
 * instant result the frame reports (display only) and, on request, the
 * authoritative score recomputed by the server from the stored package.
 */
export function PackagePreview({
  packageId,
  version,
  definition,
  definitionSha256,
  items,
  playerUrl,
}: {
  packageId: string;
  version: string;
  definition: PluginDefinition;
  definitionSha256: string;
  items: ContentItem[];
  playerUrl: string;
}) {
  const locale = useLocale();
  const t = useTranslations("editor.preview");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<ExerciseAnswer | null>(null);
  const [instant, setInstant] = useState<{ correct: boolean; score: number } | null>(null);
  const [server, setServer] = useState<EvaluateOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const item = items[index];
  if (!item) return <p className="text-sm text-ink-muted">{t("noItems")}</p>;

  const assetUrls = Object.fromEntries(
    Object.values(item.fields)
      .filter(
        (v): v is { asset: string; alt: string } =>
          typeof v === "object" && v !== null && "asset" in v && typeof (v as { asset: unknown }).asset === "string",
      )
      .map((v) => [
        v.asset,
        `/api/packages/${packageId}/assets/${v.asset.replace(/^assets\//, "")}?version=${version}`,
      ]),
  );
  const go = (next: number) => {
    setIndex(next);
    setAnswer(null);
    setInstant(null);
    setServer(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button type="button" variant="secondary" size="sm" disabled={index === 0} onClick={() => go(index - 1)}>
          {t("previous")}
        </Button>
        <span className="text-ink-muted">{t("position", { n: index + 1, total: items.length })}</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={index === items.length - 1}
          onClick={() => go(index + 1)}
        >
          {t("next")}
        </Button>
        <code className="field-ltr ms-auto text-xs text-ink-muted">{item.activity}</code>
      </div>
      <PlayerFrame
        key={item.item_id}
        playerUrl={playerUrl}
        definition={definition}
        definitionSha256={definitionSha256}
        activity={item.activity}
        item={item}
        assets={assetUrls}
        onAnswer={(a) => {
          setAnswer(a);
          setServer(null);
        }}
        onInstantResult={setInstant}
      />
      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-paper p-4 text-sm">
        <p>
          <strong>{t("instant")}:</strong>{" "}
          {instant
            ? `${instant.correct ? t("correct") : t("incorrect")} · ${Math.round(instant.score * 100)}%`
            : t("none")}
          <span className="block text-xs text-ink-muted">{t("instantNote")}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={!answer || pending}
            onClick={() =>
              startTransition(async () => {
                if (!answer) return;
                setServer(await evaluateAnswer(locale, { packageId, version, itemId: item.item_id, answer }));
              })
            }
          >
            {pending ? t("checking") : t("serverCheck")}
          </Button>
          {server ? (
            <span role="status">
              {server.ok
                ? server.displayOnly
                  ? t("displayOnly")
                  : `${t("server")}: ${server.correct ? t("correct") : t("incorrect")} · ${Math.round(server.score * 100)}%`
                : t(`errors.${server.code}`)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-ink-muted">{t("serverNote")}</p>
      </div>
    </div>
  );
}
