"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ExerciseAnswer } from "@/modules/exercises/definitions";
import { localeDirection } from "@/i18n/routing";
import { PLAYER_STRING_KEYS, PlayerToPlatform, type PlayerStringKey } from "@/modules/player/bridge";
import type { ContentItem, PluginDefinition } from "@/modules/plugins/contract";

/**
 * Embeds the sandboxed player for exactly one item (ADR 0006 §5, §9):
 * `sandbox="allow-scripts"` without `allow-same-origin`, so the frame has an
 * opaque origin — no cookies, no storage, no access to this page. The frame
 * receives the plugin definition (pinned by its hash), the item and its assets
 * as bytes; it never receives anything about the person using the page.
 *
 * The `result` message is instant feedback for display only; the server
 * recomputes any score that matters.
 */

export interface PlayerAssets {
  /** Asset path inside the package -> bytes (a Blob) or a same-origin URL to fetch them from. */
  [path: string]: Blob | string;
}

export interface PlayerFrameProps {
  playerUrl: string;
  definition: PluginDefinition;
  definitionSha256: string;
  activity: string;
  item: ContentItem;
  assets?: PlayerAssets;
  /** The learner's answer as the frame reported it (to send to the server for the authoritative score). */
  onAnswer?: (answer: ExerciseAnswer) => void;
  /** Instant result from the frame: display only. */
  onInstantResult?: (result: { correct: boolean; score: number }) => void;
  onError?: (code: string, detail?: string) => void;
  className?: string;
}

export function PlayerFrame({
  playerUrl,
  definition,
  definitionSha256,
  activity,
  item,
  assets = {},
  onAnswer,
  onInstantResult,
  onError,
  className = "",
}: PlayerFrameProps) {
  const t = useTranslations("player");
  const locale = useLocale();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const callbacks = useRef({ onAnswer, onInstantResult, onError });
  useEffect(() => {
    callbacks.current = { onAnswer, onInstantResult, onError };
  });

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Sandboxed frames have an opaque origin ("null"); the window identity is what we check.
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const parsed = PlayerToPlatform.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      switch (message.type) {
        case "ready":
          setReady(true);
          break;
        case "height":
          setHeight(Math.max(120, message.px + 8));
          break;
        case "answer":
          callbacks.current.onAnswer?.(message.answer);
          break;
        case "result":
          callbacks.current.onInstantResult?.({ correct: message.correct, score: message.score });
          break;
        case "error":
          setFailure(message.code);
          callbacks.current.onError?.(message.code, message.detail);
          break;
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    if (!ready || !frame.current?.contentWindow) return;
    let cancelled = false;
    const target = frame.current.contentWindow;
    (async () => {
      const blobs: Record<string, Blob> = {};
      for (const [path, source] of Object.entries(assets)) {
        if (source instanceof Blob) {
          blobs[path] = source;
        } else {
          const response = await fetch(source, { credentials: "same-origin" });
          if (!response.ok) continue;
          blobs[path] = await response.blob();
        }
      }
      if (cancelled) return;
      const strings = Object.fromEntries(PLAYER_STRING_KEYS.map((key: PlayerStringKey) => [key, t(key)]));
      // The frame's origin is opaque, so "*" is the only valid target; the frame checks our origin on its side.
      target.postMessage(
        {
          type: "render",
          plugin: { definition, sha256: definitionSha256 },
          activity,
          item,
          assets: blobs,
          locale,
          dir: localeDirection(locale),
          strings,
        },
        "*",
      );
    })();
    return () => {
      cancelled = true;
    };
    // The item and definition identities drive re-renders; the frame is keyed by item id by its parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, definitionSha256, activity, item.item_id, locale]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <iframe
        ref={frame}
        src={playerUrl}
        title={t("frameTitle")}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="w-full rounded-[var(--radius-card)] border border-line bg-surface"
        style={{ height }}
      />
      {failure ? (
        <p role="alert" className="text-sm text-danger">
          {t("frameError")}
        </p>
      ) : null}
    </div>
  );
}
