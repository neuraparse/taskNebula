import { render, screen } from '@testing-library/react';
import { SprintStats } from '../sprint-stats';
import type { Sprint, SprintIssue } from '@/lib/hooks/use-sprints';

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-1',
    projectId: 'project-1',
    name: 'Sprint 1',
    goal: null,
    startDate: new Date('2026-04-01T00:00:00.000Z'),
    endDate: new Date('2026-04-15T00:00:00.000Z'),
    status: 'active',
    createdAt: new Date('2026-03-30T00:00:00.000Z'),
    updatedAt: new Date('2026-03-30T00:00:00.000Z'),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  } as Sprint;
}

function makeIssue(overrides: Partial<SprintIssue> = {}): SprintIssue {
  return {
    id: 'issue-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    key: 'PRJ-1',
    number: 1,
    type: 'story',
    title: 'An issue',
    description: null,
    statusId: 'status-1',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    reporterId: 'user-1',
    labels: [],
    sprintId: 'sprint-1',
    epicId: null,
    parentId: null,
    estimate: null,
    dueDate: null,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    statusName: 'To Do',
    statusColor: '#ccc',
    ...overrides,
  } as SprintIssue;
}

describe('SprintStats', () => {
  it('renders all four stat cards', () => {
    render(<SprintStats sprint={makeSprint()} issues={[]} />);

    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Story Points')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('computes completion percentage correctly (2 of 5 done => 40%)', () => {
    const issues: SprintIssue[] = [
      makeIssue({ id: 'i-1', status: 'done', statusName: 'Done' }),
      makeIssue({ id: 'i-2', status: 'todo', statusName: 'Done' }), // via statusName
      makeIssue({ id: 'i-3', status: 'in_progress', statusName: 'In Progress' }),
      makeIssue({ id: 'i-4', status: 'todo', statusName: 'To Do' }),
      makeIssue({ id: 'i-5', status: 'todo', statusName: 'To Do' }),
    ];

    render(<SprintStats sprint={makeSprint()} issues={issues} />);

    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('2 of 5 issues')).toBeInTheDocument();
  });

  it('breaks down counts by Done, In Progress, and remaining as To Do', () => {
    const issues: SprintIssue[] = [
      makeIssue({ id: 'i-1', status: 'done' }),
      makeIssue({ id: 'i-2', statusName: 'Done' }),
      makeIssue({ id: 'i-3', status: 'in_progress' }),
      makeIssue({ id: 'i-4', statusName: 'In Progress' }),
      makeIssue({ id: 'i-5' }),
      makeIssue({ id: 'i-6' }),
      makeIssue({ id: 'i-7' }),
    ];

    render(<SprintStats sprint={makeSprint()} issues={issues} />);

    // Under "Issue Status" we should see Done=2, In Progress=2, To Do=3
    const doneRow = screen.getByText('Done').parentElement;
    const inProgressRow = screen.getByText('In Progress').parentElement;
    const todoRow = screen.getByText('To Do').parentElement;

    expect(doneRow).toHaveTextContent('2');
    expect(inProgressRow).toHaveTextContent('2');
    expect(todoRow).toHaveTextContent('3');
  });

  it('sums story points across all issues and completed issues', () => {
    const issues: SprintIssue[] = [
      makeIssue({ id: 'i-1', status: 'done', estimate: 3 }),
      makeIssue({ id: 'i-2', statusName: 'Done', estimate: 5 }),
      makeIssue({ id: 'i-3', status: 'in_progress', estimate: 2 }),
      makeIssue({ id: 'i-4', estimate: null }),
    ];

    render(<SprintStats sprint={makeSprint()} issues={issues} />);

    // totalPoints = 3 + 5 + 2 + 0 = 10, completed = 3 + 5 = 8
    // Points are rendered as "8" followed by " / 10" in separate nodes
    expect(screen.getByText((_, node) => node?.textContent === '8 / 10')).toBeInTheDocument();
    expect(screen.getByText('80% completed')).toBeInTheDocument();
  });

  it('handles empty issues array with 0 / 0 and 0%', () => {
    render(<SprintStats sprint={makeSprint()} issues={[]} />);

    expect(screen.getByText('0 of 0 issues')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === '0 / 0')).toBeInTheDocument();
    expect(screen.getByText('0% completed')).toBeInTheDocument();
    // Completion percentage also 0%
    const zeroPercents = screen.getAllByText('0%');
    expect(zeroPercents.length).toBeGreaterThanOrEqual(1);
  });

  it('clamps time progress to 0% when the current time is before sprint start', () => {
    const futureSprint = makeSprint({
      startDate: new Date('2099-01-01T00:00:00.000Z'),
      endDate: new Date('2099-01-15T00:00:00.000Z'),
    });

    render(<SprintStats sprint={futureSprint} issues={[]} />);

    // Completion (0 of 0) and Time Progress both render 0%.
    const zeroPercents = screen.getAllByText('0%');
    expect(zeroPercents.length).toBeGreaterThanOrEqual(2);
  });

  it('shows 100% and 0 days remaining after the sprint has ended', () => {
    const pastSprint = makeSprint({
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: new Date('2020-01-15T00:00:00.000Z'),
    });

    render(<SprintStats sprint={pastSprint} issues={[]} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('0 days remaining')).toBeInTheDocument();
  });
});
