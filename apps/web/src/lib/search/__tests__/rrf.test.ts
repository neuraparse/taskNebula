/**
 * @jest-environment node
 *
 * Reciprocal Rank Fusion (RRF) unit tests.
 *
 * Locked-down properties:
 *   - score formula: each list contributes 1 / (k + rank).
 *   - Symmetric across lists (the fused order does not depend on which
 *     leg we pass first when scores would tie).
 *   - Documents present in both lists outscore single-list winners when
 *     ranks are comparable.
 *   - Weight option scales contribution as documented.
 *   - Tiebreak is deterministic (lowest non-null rank, then id).
 */

import { reciprocalRankFusion } from '../rrf';

interface Doc {
  id: string;
  label?: string;
}

describe('reciprocalRankFusion', () => {
  it('computes RRF scores with default k=60', () => {
    const listA: Doc[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listB: Doc[] = [{ id: 'b' }, { id: 'a' }, { id: 'd' }];

    const fused = reciprocalRankFusion([listA, listB]);
    const byId = new Map(fused.map((f) => [f.id, f]));

    // a: 1/(60+1) + 1/(60+2)
    expect(byId.get('a')!.score).toBeCloseTo(1 / 61 + 1 / 62, 10);
    // b: 1/(60+2) + 1/(60+1) = same as a
    expect(byId.get('b')!.score).toBeCloseTo(1 / 62 + 1 / 61, 10);
    // c: only in list A at rank 3
    expect(byId.get('c')!.score).toBeCloseTo(1 / 63, 10);
    // d: only in list B at rank 3
    expect(byId.get('d')!.score).toBeCloseTo(1 / 63, 10);
  });

  it('puts dual-list hits above single-list hits when ranks are decent', () => {
    const listA: Doc[] = [{ id: 'top' }, { id: 'mid' }, { id: 'a-only' }];
    const listB: Doc[] = [{ id: 'mid' }, { id: 'top' }, { id: 'b-only' }];

    const fused = reciprocalRankFusion([listA, listB]);
    const ids = fused.map((f) => f.id);
    expect(ids.indexOf('top')).toBeLessThan(ids.indexOf('a-only'));
    expect(ids.indexOf('mid')).toBeLessThan(ids.indexOf('b-only'));
  });

  it('respects custom k', () => {
    const fused = reciprocalRankFusion([[{ id: 'x' }]], { k: 10 });
    expect(fused[0].score).toBeCloseTo(1 / 11, 10);
  });

  it('applies per-list weights', () => {
    const fused = reciprocalRankFusion(
      [[{ id: 'x' }], [{ id: 'x' }]],
      { weights: [2, 1] }
    );
    expect(fused[0].score).toBeCloseTo(2 / 61 + 1 / 61, 10);
  });

  it('returns rank=null for lists that did not contain the item', () => {
    const fused = reciprocalRankFusion([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'c' }],
    ]);
    const a = fused.find((f) => f.id === 'a')!;
    const c = fused.find((f) => f.id === 'c')!;
    expect(a.ranks).toEqual([1, null]);
    expect(c.ranks).toEqual([null, 2]);
  });

  it('ties break by smallest non-null rank, then by id', () => {
    const fused = reciprocalRankFusion([
      [{ id: 'x' }, { id: 'y' }, { id: 'z' }],
      [],
    ]);
    expect(fused.map((f) => f.id)).toEqual(['x', 'y', 'z']);
  });

  it('throws when weights and lists arity differ', () => {
    expect(() =>
      reciprocalRankFusion([[{ id: 'a' }], [{ id: 'b' }]], { weights: [1] })
    ).toThrow(/weights/);
  });

  it('handles empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([[]])).toEqual([]);
  });

  it('result is stable for the same input', () => {
    const listA: Doc[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const listB: Doc[] = [{ id: 'b' }, { id: 'c' }, { id: 'a' }];
    const fused1 = reciprocalRankFusion([listA, listB]).map((f) => f.id);
    const fused2 = reciprocalRankFusion([listA, listB]).map((f) => f.id);
    expect(fused1).toEqual(fused2);
  });
});
