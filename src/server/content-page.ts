import "server-only";

import { notFound } from "next/navigation";
import { canEdit } from "@/modules/authorization/policies";
import { getSession, requireCapability } from "@/server/actor";
import { getContentItem, type ContentRow } from "@/server/queries/content";

/**
 * Shared entry of every page under /content/[id]: the member must hold
 * content.create, the item must exist and be theirs to edit (moderation
 * edits other people's content from S4 on). Anything else is a 404.
 */
export async function loadContentPage(
  locale: string,
  id: string,
): Promise<{ item: ContentRow; editable: boolean; userId: string }> {
  const session = await requireCapability(locale, "content.create", `/${locale}/content/${id}`);
  const [{ actor }, item] = await Promise.all([getSession(), getContentItem(id)]);
  if (!item || actor.kind !== "user") notFound();
  const decision = canEdit(actor, { ownerId: item.ownerId, status: item.status, isPaid: false });
  if (!decision.allowed && decision.reason !== "under_moderation") notFound();
  void session;
  return { item, editable: decision.allowed, userId: actor.userId };
}
