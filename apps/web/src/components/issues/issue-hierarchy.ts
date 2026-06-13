/**
 * Pure helpers for walking the issue parent/child hierarchy on the client.
 *
 * Used by the parent picker to exclude issues that would create a cycle:
 * an issue cannot become a child of itself or of any of its descendants.
 * Best-effort by design — it only sees the edges it is given (the issues
 * currently loaded for the project), mirroring the server's lack of a
 * cycle check on PATCH `parentId`.
 */

/** Minimal parent-edge shape needed to walk the hierarchy. */
export interface IssueEdge {
  id: string;
  parentId?: string | null;
}

/**
 * Returns the set of issue ids that must NOT be offered as a parent for
 * `selfId`: the issue itself plus every transitive descendant.
 */
export function collectExcludedParentIds(
  edges: ReadonlyArray<IssueEdge>,
  selfId: string
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.parentId) continue;
    const siblings = childrenByParent.get(edge.parentId);
    if (siblings) {
      siblings.push(edge.id);
    } else {
      childrenByParent.set(edge.parentId, [edge.id]);
    }
  }

  const excluded = new Set<string>([selfId]);
  const queue: string[] = [selfId];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    for (const childId of childrenByParent.get(current) ?? []) {
      // The visited-set guard keeps this terminating even if the loaded
      // data already contains a cycle (bad legacy rows).
      if (!excluded.has(childId)) {
        excluded.add(childId);
        queue.push(childId);
      }
    }
  }
  return excluded;
}
