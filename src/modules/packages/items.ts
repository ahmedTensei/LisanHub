import { ItemId, type ContentItem } from "@/modules/plugins/contract";

/**
 * Item identity. Progress and spaced repetition are keyed to `item_id`, so an
 * id is assigned once, when the item is created, and survives every edit,
 * reorder and republication. Nothing ever renumbers items.
 */

export function newItemId(): string {
  return crypto.randomUUID();
}

export function isItemId(value: unknown): value is string {
  return ItemId.safeParse(value).success;
}

/** Gives fresh ids to items that lack one and keeps every existing id untouched. */
export function withStableIds<T extends { item_id?: string }>(items: readonly T[]): (T & { item_id: string })[] {
  const seen = new Set<string>();
  return items.map((item) => {
    let id = isItemId(item.item_id) && !seen.has(item.item_id) ? item.item_id : newItemId();
    while (seen.has(id)) id = newItemId();
    seen.add(id);
    return { ...item, item_id: id };
  });
}

/** Replaces one item's fields in place; the id and the position are preserved. */
export function updateItem(
  items: readonly ContentItem[],
  itemId: string,
  patch: Partial<Omit<ContentItem, "item_id">>,
): ContentItem[] {
  return items.map((item) => (item.item_id === itemId ? { ...item, ...patch, item_id: item.item_id } : item));
}

export function moveItem(items: readonly ContentItem[], itemId: string, direction: -1 | 1): ContentItem[] {
  const index = items.findIndex((i) => i.item_id === itemId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeItem(items: readonly ContentItem[], itemId: string): ContentItem[] {
  return items.filter((i) => i.item_id !== itemId);
}
