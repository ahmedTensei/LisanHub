export interface LineageNode {
  itemId: string;
  title: string;
  ownerId: string;
  /** The item this one was derived from, if any. */
  derivedFromItemId: string | null;
  /** False when the source was removed; provenance must still be shown honestly. */
  available: boolean;
}

export type LineageLookup = (itemId: string) => LineageNode | undefined;

/**
 * The personal upward chain: this copy -> its source -> ... -> the original.
 * Sibling derivations by other users are deliberately never included.
 */
export function upwardChain(startItemId: string, lookup: LineageLookup, maxDepth = 50): LineageNode[] {
  const chain: LineageNode[] = [];
  const seen = new Set<string>();
  let current = lookup(startItemId);

  while (current && chain.length < maxDepth) {
    if (seen.has(current.itemId)) break;
    seen.add(current.itemId);
    chain.push(current);
    current = current.derivedFromItemId ? lookup(current.derivedFromItemId) : undefined;
  }
  return chain;
}

/** True when the owner should be told their work has been widely derived. Threshold is a platform setting. */
export function shouldNotifyDerivations(previousCount: number, newCount: number, threshold: number): boolean {
  return threshold > 0 && previousCount < threshold && newCount >= threshold;
}
