/**
 * Reciprocal Rank Fusion (RRF).
 *
 * Combines several ranked lists (e.g. BM25 + vector cosine top-K) into a
 * single fused ranking without needing the original scores to be
 * commensurable. Score per document d:
 *
 *     RRF(d) = Σ_i  1 / (k + rank_i(d))
 *
 * where rank_i starts at 1 in list i and k (default 60) is a smoothing
 * constant from Cormack, Clarke & Buettcher (2009). The list is robust:
 * an item ranked 1 in BM25 and 50 in vector beats an item ranked 5 in
 * both, as long as BM25's signal is strong.
 *
 * We expose a generic helper so the search route can fuse rows of any
 * shape — it only needs `id` to deduplicate.
 */

export interface RankedItem {
  id: string;
}

export interface RRFOptions {
  /** Smoothing constant. Larger k => flatter weighting. Default 60. */
  k?: number;
  /** Optional per-list weights, applied as multipliers on the 1/(k+rank) score. */
  weights?: number[];
}

export interface FusedItem<T extends RankedItem> {
  id: string;
  score: number;
  /** The item from the first list that contained it. */
  item: T;
  /** 1-based rank of the item in each input list, or null when absent. */
  ranks: Array<number | null>;
}

/**
 * Fuse N ranked lists into one. Stable for documents tied on the fused
 * score — ties break by lower first-seen rank, then by id.
 */
export function reciprocalRankFusion<T extends RankedItem>(
  lists: T[][],
  options: RRFOptions = {}
): FusedItem<T>[] {
  const k = options.k ?? 60;
  const weights = options.weights ?? lists.map(() => 1);

  if (weights.length !== lists.length) {
    throw new Error(
      `RRF: weights.length (${weights.length}) must match lists.length (${lists.length})`
    );
  }

  const fused = new Map<string, FusedItem<T>>();

  lists.forEach((list, listIdx) => {
    const weight = weights[listIdx] ?? 1;
    list.forEach((item, idx) => {
      const rank = idx + 1; // 1-based
      const contribution = weight / (k + rank);
      const existing = fused.get(item.id);
      if (existing) {
        existing.score += contribution;
        existing.ranks[listIdx] = rank;
      } else {
        const ranks: Array<number | null> = lists.map(() => null);
        ranks[listIdx] = rank;
        fused.set(item.id, {
          id: item.id,
          score: contribution,
          item,
          ranks,
        });
      }
    });
  });

  const result = Array.from(fused.values());
  result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: lowest non-null rank wins.
    const aMin = Math.min(...a.ranks.filter((r): r is number => r !== null));
    const bMin = Math.min(...b.ranks.filter((r): r is number => r !== null));
    if (aMin !== bMin) return aMin - bMin;
    return a.id.localeCompare(b.id);
  });
  return result;
}
