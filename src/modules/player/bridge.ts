import * as z from "zod/mini";
import { UI_LOCALES } from "@/modules/account/ui-locales";
import { ExerciseAnswer } from "@/modules/exercises/definitions";
import { ContentItem, PluginDefinition, Sha256Hex } from "@/modules/plugins/contract";
import { Slug } from "@/modules/plugins/fields";

/**
 * The only channel between the platform page and the sandboxed player
 * (ADR 0006 §5). Both sides validate every message with these schemas and
 * check the sender. The set is deliberately small, and no message carries
 * anything about the person answering: no id, no name, no progress, no
 * settings, no session. A test walks these schemas to keep it that way.
 */

/** Interface strings the player shows; passed in so the player owns no locale files. */
export const PLAYER_STRING_KEYS = [
  "check",
  "reset",
  "reveal",
  "correct",
  "incorrect",
  "expected",
  "again",
  "hard",
  "good",
  "easy",
  "chooseOne",
  "orderHint",
  "matchHint",
  "blankHint",
  "empty",
] as const;
export type PlayerStringKey = (typeof PLAYER_STRING_KEYS)[number];

const AssetName = z.string().check(z.regex(/^assets\/[a-z0-9][a-z0-9._-]*$/));

export const RenderMessage = z.object({
  type: z.literal("render"),
  /** The whole plugin definition and the hash it was published with; the player recomputes it before use. */
  plugin: z.object({ definition: PluginDefinition, sha256: Sha256Hex }),
  activity: Slug,
  item: ContentItem,
  /** Assets referenced by the item, as bytes — never a URL, never anything signed for a user. */
  assets: z.record(AssetName, z.instanceof(Blob)),
  locale: z.enum(UI_LOCALES),
  dir: z.enum(["rtl", "ltr"]),
  strings: z.record(z.enum(PLAYER_STRING_KEYS), z.string()),
});

export const CheckMessage = z.object({ type: z.literal("check") });
export const ResetMessage = z.object({ type: z.literal("reset") });

export const PlatformToPlayer = z.discriminatedUnion("type", [RenderMessage, CheckMessage, ResetMessage]);
export type PlatformToPlayer = z.infer<typeof PlatformToPlayer>;

export const PLAYER_ERROR_CODES = [
  "invalid_message",
  "definition_hash_mismatch",
  "activity_missing",
  "asset_missing",
  "render_failed",
] as const;

export const ReadyMessage = z.object({ type: z.literal("ready") });
export const HeightMessage = z.object({ type: z.literal("height"), px: z.int().check(z.gte(0), z.lte(20_000)) });
export const AnswerMessage = z.object({ type: z.literal("answer"), answer: ExerciseAnswer });
/** Instant feedback only: never stored, never trusted (the server re-evaluates). */
export const ResultMessage = z.object({
  type: z.literal("result"),
  correct: z.boolean(),
  score: z.number().check(z.gte(0), z.lte(1)),
  expected: z.optional(z.unknown()),
});
export const ErrorMessage = z.object({
  type: z.literal("error"),
  code: z.enum(PLAYER_ERROR_CODES),
  detail: z.optional(z.string().check(z.maxLength(500))),
});

export const PlayerToPlatform = z.discriminatedUnion("type", [
  ReadyMessage,
  HeightMessage,
  AnswerMessage,
  ResultMessage,
  ErrorMessage,
]);
export type PlayerToPlatform = z.infer<typeof PlayerToPlatform>;

/** Names that must never appear anywhere in a bridge message shape. */
export const FORBIDDEN_MESSAGE_FIELDS = [
  "user",
  "user_id",
  "userId",
  "email",
  "username",
  "display_name",
  "displayName",
  "actor",
  "session",
  "token",
  "jwt",
  "cookie",
  "progress",
  "review",
  "review_state",
  "streak",
  "settings",
  "preferences",
  "owner_id",
  "avatar",
  "url",
  "signed_url",
] as const;
