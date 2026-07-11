import type { Issue, WorkflowStatus } from '@/api/types';
import { buildProjectBoardColumns } from './project-board';

const statuses: WorkflowStatus[] = [
  { id: 'done', name: 'Done', category: 'done', color: '#22c55e', position: 30 },
  { id: 'todo', name: 'To Do', category: 'todo', color: '#64748b', position: 10 },
  {
    id: 'review',
    name: 'Review',
    category: 'in_review',
    color: '#a855f7',
    position: 20,
  },
];

function issue(input: Partial<Issue> & Pick<Issue, 'id' | 'title'>): Issue {
  const { id, title, ...rest } = input;
  return {
    id,
    projectId: 'project_1',
    type: 'task',
    title,
    priority: 'medium',
    ...rest,
  };
}

describe('project board column grouping', () => {
  it('uses project workflow statuses instead of fixed status categories', () => {
    const columns = buildProjectBoardColumns(
      [
        issue({ id: 'issue_direct', title: 'Direct', statusId: 'review' }),
        issue({
          id: 'issue_category',
          title: 'Category fallback',
          status: { id: 'legacy_done', name: 'Done', category: 'done' },
        }),
        issue({
          id: 'issue_orphan',
          title: 'Unknown status',
          statusId: 'deleted_status',
          status: { id: 'deleted_status', name: 'Deleted' },
        }),
      ],
      statuses,
    );

    expect(columns.map((column) => column.status.id)).toEqual(['todo', 'review', 'done']);
    expect(columns.map((column) => column.issues.map((item) => item.id))).toEqual([
      ['issue_orphan'],
      ['issue_direct'],
      ['issue_category'],
    ]);
  });
});
