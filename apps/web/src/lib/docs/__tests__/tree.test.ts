import { buildDocumentTree } from '../tree';

describe('buildDocumentTree', () => {
  it('nests child pages and preserves position ordering', () => {
    const tree = buildDocumentTree([
      {
        id: 'child-b',
        parentId: 'root',
        title: 'Child B',
        slug: 'child-b',
        icon: null,
        projectId: null,
        currentRevision: 1,
        updatedAt: '2026-04-03T00:00:00.000Z',
        position: 2,
      },
      {
        id: 'root',
        parentId: null,
        title: 'Root',
        slug: 'root',
        icon: null,
        projectId: null,
        currentRevision: 2,
        updatedAt: '2026-04-03T00:00:00.000Z',
        position: 0,
      },
      {
        id: 'child-a',
        parentId: 'root',
        title: 'Child A',
        slug: 'child-a',
        icon: null,
        projectId: null,
        currentRevision: 3,
        updatedAt: '2026-04-03T00:00:00.000Z',
        position: 1,
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('root');
    expect(tree[0]?.children.map((node) => node.id)).toEqual(['child-a', 'child-b']);
  });

  it('treats orphaned pages as roots', () => {
    const tree = buildDocumentTree([
      {
        id: 'orphan',
        parentId: 'missing',
        title: 'Orphan',
        slug: 'orphan',
        icon: null,
        projectId: null,
        currentRevision: 1,
        updatedAt: '2026-04-03T00:00:00.000Z',
        position: 0,
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('orphan');
    expect(tree[0]?.children).toEqual([]);
  });
});
