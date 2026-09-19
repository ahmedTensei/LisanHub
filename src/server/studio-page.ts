import "server-only";

import { notFound } from "next/navigation";
import { canEditPlugin } from "@/modules/authorization/policies";
import { getSession, requireCapability } from "@/server/actor";
import { getStudioPlugin, type StudioPluginRow } from "@/server/queries/studio";

/**
 * Shared entry of every page under /studio/[id]: the member must hold
 * plugins.author, the plugin must exist and be theirs to edit (or the
 * platform's, for the owner rank). Anything else is a 404, so foreign drafts
 * do not even appear to exist.
 */
export async function loadStudioPage(
  locale: string,
  id: string,
): Promise<{ plugin: StudioPluginRow; editable: boolean }> {
  await requireCapability(locale, "plugins.author", `/${locale}/studio/${id}`);
  const [session, plugin] = await Promise.all([getSession(), getStudioPlugin(id)]);
  if (!plugin) notFound();
  const decision = canEditPlugin(session.actor, {
    ownerId: plugin.ownerId,
    status: plugin.status,
    disabled: plugin.disabled,
  });
  if (!decision.allowed && decision.reason !== "plugin_disabled") notFound();
  return { plugin, editable: decision.allowed };
}
