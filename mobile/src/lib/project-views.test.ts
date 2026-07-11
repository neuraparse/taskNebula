import {
  buildProjectViewCriteria,
  criteriaSummary,
  filtersFromCriteria,
  sortByViewType,
} from './project-views';

describe('project view helpers', () => {
  it('builds web-compatible criteria from mobile filters', () => {
    expect(
      buildProjectViewCriteria({
        filters: { query: 'auth', status: 'in_progress', sprintId: 'all', type: 'bug' },
        scope: 'project',
        viewType: 'board',
        isDefault: true,
      }),
    ).toMatchObject({
      search: 'auth',
      status: 'in_progress',
      type: 'bug',
      scope: 'project',
      teamspaceId: null,
      defaultView: true,
      groupBy: 'status',
      sort: { field: 'updatedAt', direction: 'desc' },
    });
  });

  it('keeps teamspace ids only for teamspace-scoped criteria', () => {
    const filters = { query: '', status: 'all', sprintId: 'all', type: 'all' } as const;

    expect(
      buildProjectViewCriteria({
        filters,
        scope: 'teamspace',
        teamspaceId: 'team_1',
        viewType: 'list',
      }).teamspaceId,
    ).toBe('team_1');

    expect(
      buildProjectViewCriteria({
        filters,
        scope: 'project',
        teamspaceId: 'team_1',
        viewType: 'list',
      }).teamspaceId,
    ).toBeNull();
  });

  it('normalizes saved criteria into mobile filters', () => {
    expect(
      filtersFromCriteria({
        search: 'release',
        status: 'done',
        sprintId: 'sprint_1',
        type: 'story',
      }),
    ).toEqual({
      query: 'release',
      status: 'done',
      sprintId: 'sprint_1',
      type: 'story',
    });

    expect(filtersFromCriteria({ status: 'unknown', type: 'subtask' })).toEqual({
      query: '',
      status: 'all',
      sprintId: 'all',
      type: 'all',
    });
  });

  it('sorts timeline/calendar views by due date and lists by update time', () => {
    const items = [
      { id: 'late', dueDate: '2026-08-01', updatedAt: '2026-06-01' },
      { id: 'early', dueDate: '2026-07-01', updatedAt: '2026-06-03' },
      { id: 'none', dueDate: null, updatedAt: '2026-06-04' },
    ];

    expect(sortByViewType(items, 'timeline').map((item) => item.id)).toEqual([
      'early',
      'late',
      'none',
    ]);
    expect(sortByViewType(items, 'list').map((item) => item.id)).toEqual(['none', 'early', 'late']);
  });

  it('summarizes useful saved criteria chips', () => {
    expect(
      criteriaSummary({
        search: 'auth',
        status: 'todo',
        type: 'bug',
        labels: ['mobile', 42, 'release'],
      }),
    ).toEqual(['auth', 'todo', 'bug', 'mobile', 'release']);
  });
});
