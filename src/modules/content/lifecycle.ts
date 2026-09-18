export const CONTENT_STATUSES = ["draft", "published", "archived", "hidden", "removed"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type TransitionActor = "owner" | "moderation";

const OWNER_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ["published"],
  published: ["archived", "draft"],
  archived: ["published"],
  hidden: [],
  removed: [],
};

const MODERATION_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ["published", "hidden", "removed"],
  published: ["archived", "hidden", "removed"],
  archived: ["published", "hidden", "removed"],
  hidden: ["published", "archived", "removed"],
  removed: ["hidden", "archived"],
};

/**
 * Publication is never equivalent to creation, nothing is deleted without a trace,
 * and only moderation hides, removes or restores moderated content.
 * Mirrors the `content_items_guard` trigger in the database.
 */
export function canTransition(from: ContentStatus, to: ContentStatus, actor: TransitionActor): boolean {
  if (from === to) return true;
  const table = actor === "moderation" ? MODERATION_TRANSITIONS : OWNER_TRANSITIONS;
  return table[from].includes(to);
}
