import { MAX_INITIATIVE_DEPTH } from '@tasknebula/db';

/**
 * Initiative depth helpers.
 *
 * Sub-initiatives nest by setting `parent_initiative_id`. The roadmap caps
 * depth at 5 levels (root = level 1, deepest = level 5). The cap is enforced
 * in the API layer instead of via DB triggers so that the same logic is
 * reusable in jest tests without needing a live Postgres.
 */

export interface InitiativeNode {
  id: string;
  parentInitiativeId: string | null;
}

/**
 * Compute the 1-indexed depth of an initiative inside an ancestry map.
 *
 * @param initiativeId the node whose depth we want
 * @param byId         map of every initiative the workspace knows about
 * @returns            depth (>= 1). A root initiative is depth 1.
 *
 * Cycle protection: walking stops if a node references itself or if depth
 * exceeds `MAX_INITIATIVE_DEPTH + 10` (defensive — should never happen, but
 * a corrupted parent pointer should not produce an infinite loop).
 */
export function getInitiativeDepth(
  initiativeId: string,
  byId: Map<string, InitiativeNode>
): number {
  let depth = 1;
  let cursor: string | null = initiativeId;
  const visited = new Set<string>();

  while (cursor) {
    if (visited.has(cursor)) {
      throw new Error(`Initiative cycle detected at ${cursor}`);
    }
    visited.add(cursor);

    const node = byId.get(cursor);
    if (!node || !node.parentInitiativeId) {
      return depth;
    }
    cursor = node.parentInitiativeId;
    depth += 1;

    if (depth > MAX_INITIATIVE_DEPTH + 10) {
      throw new Error(
        `Initiative depth exceeded sanity bound for ${initiativeId}`
      );
    }
  }
  return depth;
}

/**
 * Validate that attaching a node with parent `parentId` does not push the
 * resulting tree past `MAX_INITIATIVE_DEPTH`.
 *
 * @param parentId the proposed parent (null => root insertion is always ok)
 * @param byId     map of existing initiatives in the same workspace
 * @returns        an object describing the violation, or null if OK
 */
export function validateInitiativeDepth(
  parentId: string | null,
  byId: Map<string, InitiativeNode>
): { allowed: false; depth: number; max: number } | { allowed: true } {
  if (!parentId) return { allowed: true };

  const parentDepth = getInitiativeDepth(parentId, byId);
  const childDepth = parentDepth + 1;

  if (childDepth > MAX_INITIATIVE_DEPTH) {
    return { allowed: false, depth: childDepth, max: MAX_INITIATIVE_DEPTH };
  }
  return { allowed: true };
}

/**
 * Build a parent-id map suitable for {@link getInitiativeDepth}.
 */
export function buildInitiativeIndex(
  rows: Iterable<InitiativeNode>
): Map<string, InitiativeNode> {
  const map = new Map<string, InitiativeNode>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return map;
}
