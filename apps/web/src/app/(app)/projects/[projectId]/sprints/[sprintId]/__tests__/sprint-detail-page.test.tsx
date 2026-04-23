/**
 * Tests for SprintDetailPage — /projects/[projectId]/sprints/[sprintId]
 *
 * Covers:
 *   - renders sprint header + stats for an active sprint
 *   - "Sprint not found" fallback when the sprint query returns null
 */

import { Suspense, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SprintDetailPage from '../page';
import { useSprint, useSprintIssues, useUpdateSprint } from '@/lib/hooks/use-sprints';
import { useBurndown } from '@/lib/hooks/use-analytics';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';

jest.mock('@/lib/hooks/use-sprints', () => ({
  useSprint: jest.fn(),
  useSprintIssues: jest.fn(),
  useUpdateSprint: jest.fn(),
}));

jest.mock('@/lib/hooks/use-analytics', () => ({
  useBurndown: jest.fn(),
}));

jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: jest.fn(),
}));

// Heavy children we don't need to exercise here
jest.mock('@/components/kanban/kanban-board', () => ({
  KanbanBoard: ({ projectId, sprintId }: { projectId: string; sprintId: string }) => (
    <div data-testid="kanban-board">
      {projectId}:{sprintId}
    </div>
  ),
}));
jest.mock('@/components/analytics/burndown-chart', () => ({
  BurndownChart: () => <div data-testid="burndown-chart" />,
}));

const mockUseSprint = useSprint as jest.MockedFunction<typeof useSprint>;
const mockUseSprintIssues = useSprintIssues as jest.MockedFunction<typeof useSprintIssues>;
const mockUseUpdateSprint = useUpdateSprint as jest.MockedFunction<typeof useUpdateSprint>;
const mockUseBurndown = useBurndown as jest.MockedFunction<typeof useBurndown>;
const mockUseProjectPermissions = useProjectPermissions as jest.MockedFunction<
  typeof useProjectPermissions
>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-fallback" />}>{children}</Suspense>
    </QueryClientProvider>
  );
}

// React 19's `use(promise)` suspends indefinitely on a plain Promise in
// tests unless the promise is pre-tagged as fulfilled.
function resolvedParams<T extends object>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & { status: string; value: T };
  p.status = 'fulfilled';
  p.value = value;
  return p;
}

describe('SprintDetailPage', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseUpdateSprint.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateSprint>);

    mockUseBurndown.mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useBurndown>);

    mockUseProjectPermissions.mockReturnValue({
      permissions: {
        canBrowseProject: true,
        canManageSprints: true,
        canDeleteSprint: true,
        canStartSprint: true,
        canCompleteSprint: true,
        isSuperAdmin: false,
        isOrgOwner: false,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useProjectPermissions>);
  });

  it('renders sprint header and stats for an active sprint with issues', async () => {
    mockUseSprint.mockReturnValue({
      data: {
        id: 'sprint-1',
        projectId: 'project-1',
        name: 'Sprint Alpha',
        goal: 'Ship the MVP',
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2099-12-31T00:00:00.000Z'),
        status: 'active',
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        updatedAt: new Date('2026-03-30T00:00:00.000Z'),
        createdBy: 'user-1',
        updatedBy: 'user-1',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useSprint>);

    mockUseSprintIssues.mockReturnValue({
      data: [
        {
          id: 'i-1',
          key: 'PRJ-1',
          title: 'Done thing',
          status: 'done',
          statusName: 'Done',
          estimate: 3,
        },
        {
          id: 'i-2',
          key: 'PRJ-2',
          title: 'Open thing',
          status: 'todo',
          statusName: 'To Do',
          estimate: 2,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprintIssues>);

    render(
      <Wrapper>
        <SprintDetailPage
          params={resolvedParams({ projectId: 'project-1', sprintId: 'sprint-1' })}
        />
      </Wrapper>
    );

    // Sprint name, goal, and active status badge all render.
    // Two nodes (page h1 + stats h3) both render the name; target the h1.
    expect(
      await screen.findByRole('heading', { name: 'Sprint Alpha', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('Ship the MVP')).toBeInTheDocument();
    // "Active" renders twice (header badge + stats chip)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);

    // Header shows completed / total issue count
    expect(screen.getByText('1 / 2 issues completed')).toBeInTheDocument();

    // Stats card renders "1 of 2 issues" (from SprintStats component)
    expect(screen.getByText('1 of 2 issues')).toBeInTheDocument();

    // Kanban board is mounted with the right IDs
    expect(screen.getByTestId('kanban-board')).toHaveTextContent('project-1:sprint-1');

    // Complete Sprint button visible for active sprints
    expect(screen.getByRole('button', { name: /Complete Sprint/i })).toBeInTheDocument();
  });

  it('renders "Sprint not found" when useSprint returns null data', async () => {
    mockUseSprint.mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useSprint>);

    mockUseSprintIssues.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprintIssues>);

    render(
      <Wrapper>
        <SprintDetailPage
          params={resolvedParams({ projectId: 'project-1', sprintId: 'missing' })}
        />
      </Wrapper>
    );

    expect(await screen.findByText('Sprint not found')).toBeInTheDocument();
  });
});
