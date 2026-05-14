/**
 * @jest-environment node
 */
import {
  buildInitiativeIndex,
  getInitiativeDepth,
  validateInitiativeDepth,
  type InitiativeNode,
} from '../depth';
import {
  collectInitiativeAndDescendants,
  rollUpProgress,
  type ProjectIssueCounts,
} from '../rollup';

/**
 * Build a chain of nested initiatives: a → b → c → d → e
 * (e is depth 5, deepest still allowed).
 */
function buildChain(length: number): InitiativeNode[] {
  const out: InitiativeNode[] = [];
  for (let i = 0; i < length; i++) {
    out.push({
      id: `n${i}`,
      parentInitiativeId: i === 0 ? null : `n${i - 1}`,
    });
  }
  return out;
}

describe('initiative depth helpers', () => {
  it('reports depth 1 for a root initiative', () => {
    const index = buildInitiativeIndex([{ id: 'root', parentInitiativeId: null }]);
    expect(getInitiativeDepth('root', index)).toBe(1);
  });

  it('walks parent chain to compute depth', () => {
    const chain = buildChain(4); // depths 1..4
    const index = buildInitiativeIndex(chain);
    expect(getInitiativeDepth('n0', index)).toBe(1);
    expect(getInitiativeDepth('n1', index)).toBe(2);
    expect(getInitiativeDepth('n2', index)).toBe(3);
    expect(getInitiativeDepth('n3', index)).toBe(4);
  });

  it('allows attaching a child when parent is at depth <= 4', () => {
    const chain = buildChain(4); // last node is depth 4
    const index = buildInitiativeIndex(chain);
    // attaching child of n3 → resulting depth 5, still allowed.
    expect(validateInitiativeDepth('n3', index)).toEqual({ allowed: true });
  });

  it('refuses attaching a child when parent is already at depth 5', () => {
    const chain = buildChain(5); // last node is depth 5
    const index = buildInitiativeIndex(chain);
    const verdict = validateInitiativeDepth('n4', index);
    expect(verdict).toEqual({ allowed: false, depth: 6, max: 5 });
  });

  it('always allows root-level inserts', () => {
    const index = buildInitiativeIndex([]);
    expect(validateInitiativeDepth(null, index)).toEqual({ allowed: true });
  });

  it('detects parent cycles instead of looping forever', () => {
    const index = buildInitiativeIndex([
      { id: 'a', parentInitiativeId: 'b' },
      { id: 'b', parentInitiativeId: 'a' },
    ]);
    expect(() => getInitiativeDepth('a', index)).toThrow(/cycle/i);
  });
});

describe('rollUpProgress', () => {
  it('returns 0% when there are no issues', () => {
    expect(rollUpProgress({ projects: [] })).toEqual({
      done: 0,
      total: 0,
      percent: 0,
      projectCount: 0,
    });
  });

  it('aggregates across projects', () => {
    const buckets: ProjectIssueCounts[] = [
      { projectId: 'p1', done: 3, total: 10 },
      { projectId: 'p2', done: 7, total: 10 },
    ];
    const result = rollUpProgress({ projects: buckets });
    expect(result).toEqual({ done: 10, total: 20, percent: 50, projectCount: 2 });
  });

  it('rounds percent to nearest integer', () => {
    const buckets: ProjectIssueCounts[] = [
      { projectId: 'p1', done: 1, total: 3 },
    ];
    const result = rollUpProgress({ projects: buckets });
    // 1/3 = 33.33 → 33
    expect(result.percent).toBe(33);
  });

  it('100% when every issue is done', () => {
    const buckets: ProjectIssueCounts[] = [
      { projectId: 'p1', done: 5, total: 5 },
      { projectId: 'p2', done: 2, total: 2 },
    ];
    expect(rollUpProgress({ projects: buckets }).percent).toBe(100);
  });
});

describe('collectInitiativeAndDescendants', () => {
  it('walks the subtree including the root', () => {
    // root → a, b ; a → c
    const children = new Map<string | null, string[]>([
      ['root', ['a', 'b']],
      ['a', ['c']],
    ]);
    expect(collectInitiativeAndDescendants('root', children).sort()).toEqual(
      ['a', 'b', 'c', 'root'].sort()
    );
  });

  it('returns just the root if there are no descendants', () => {
    const children = new Map<string | null, string[]>();
    expect(collectInitiativeAndDescendants('solo', children)).toEqual(['solo']);
  });
});
