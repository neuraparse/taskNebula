import { collectExcludedParentIds, type IssueEdge } from '../issue-hierarchy';

describe('collectExcludedParentIds', () => {
  it('always excludes the issue itself', () => {
    const edges: IssueEdge[] = [{ id: 'a' }, { id: 'b' }];

    const excluded = collectExcludedParentIds(edges, 'a');

    expect(excluded).toEqual(new Set(['a']));
  });

  it('excludes direct children', () => {
    const edges: IssueEdge[] = [
      { id: 'root', parentId: null },
      { id: 'child-1', parentId: 'root' },
      { id: 'child-2', parentId: 'root' },
      { id: 'unrelated', parentId: null },
    ];

    const excluded = collectExcludedParentIds(edges, 'root');

    expect(excluded).toEqual(new Set(['root', 'child-1', 'child-2']));
    expect(excluded.has('unrelated')).toBe(false);
  });

  it('excludes transitive descendants (grandchildren and deeper)', () => {
    const edges: IssueEdge[] = [
      { id: 'root' },
      { id: 'child', parentId: 'root' },
      { id: 'grandchild', parentId: 'child' },
      { id: 'great-grandchild', parentId: 'grandchild' },
      { id: 'sibling-tree', parentId: 'other' },
      { id: 'other' },
    ];

    const excluded = collectExcludedParentIds(edges, 'root');

    expect(excluded).toEqual(new Set(['root', 'child', 'grandchild', 'great-grandchild']));
  });

  it('does not exclude ancestors — re-parenting upward stays legal', () => {
    const edges: IssueEdge[] = [
      { id: 'grandparent' },
      { id: 'parent', parentId: 'grandparent' },
      { id: 'self', parentId: 'parent' },
    ];

    const excluded = collectExcludedParentIds(edges, 'self');

    expect(excluded).toEqual(new Set(['self']));
  });

  it('terminates on pre-existing cycles in the data', () => {
    const edges: IssueEdge[] = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'a' },
    ];

    const excluded = collectExcludedParentIds(edges, 'a');

    expect(excluded).toEqual(new Set(['a', 'b', 'c']));
  });

  it('handles an empty edge list', () => {
    expect(collectExcludedParentIds([], 'x')).toEqual(new Set(['x']));
  });
});
