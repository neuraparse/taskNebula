import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectViewsShell } from '../project-views-shell';
import { useIssues } from '@/lib/hooks/use-issues';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';

jest.mock('@/lib/hooks/use-issues', () => ({
  useIssues: jest.fn(),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: jest.fn(),
}));

jest.mock('@/lib/hooks/use-teamspaces', () => ({
  useTeamspaces: jest.fn(),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/components/kanban/kanban-board', () => ({
  KanbanBoard: ({ projectId, filters }: { projectId: string; filters: { search: string } }) => (
    <div data-testid="kanban-board">
      board:{projectId}:{filters.search || 'none'}
    </div>
  ),
}));

jest.mock('@/components/kanban/board-filters', () => {
  const DEFAULT_BOARD_FILTERS = {
    search: '',
    priority: [],
    assignee: [],
    labels: [],
  };

  return {
    DEFAULT_BOARD_FILTERS,
    BoardFiltersBar: ({
      filters,
      issueCount,
      filteredCount,
    }: {
      filters: { search: string };
      issueCount: number;
      filteredCount: number;
    }) => (
      <div>
        <span data-testid="filters-search">{filters.search}</span>
        <span data-testid="filters-counts">
          {filteredCount}/{issueCount}
        </span>
      </div>
    ),
  };
});

jest.mock('@/components/issues/create-issue-modal', () => ({
  CreateIssueModal: () => null,
}));

jest.mock('@/components/issues/issue-detail-modal', () => ({
  IssueDetailModal: ({ issueId }: { issueId: string }) => (
    <div data-testid="issue-detail-modal">{issueId}</div>
  ),
}));

const mockUseIssues = useIssues as jest.MockedFunction<typeof useIssues>;
const mockUseOrganization = useOrganization as jest.MockedFunction<typeof useOrganization>;
const mockUseTeamspaces = useTeamspaces as jest.MockedFunction<typeof useTeamspaces>;
const fetchMock = jest.fn();

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('ProjectViewsShell', () => {
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
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;

    mockUseOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      currentTeamId: 'team-1',
    } as ReturnType<typeof useOrganization>);

    mockUseTeamspaces.mockReturnValue({
      data: [
        {
          id: 'team-1',
          name: 'Platform',
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useTeamspaces>);

    mockUseIssues.mockReturnValue({
      data: [
        {
          id: 'issue-1',
          key: 'API-1',
          title: 'Release calendar work',
          description: 'Prepare release timeline',
          type: 'task',
          status: 'todo',
          statusName: 'Todo',
          priority: 'high',
          assigneeId: null,
          reporterId: 'user-1',
          organizationId: 'org-1',
          projectId: 'project-1',
          sprintId: null,
          estimate: null,
          dueDate: '2026-04-15',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          assignee: null,
          reporter: null,
        },
        {
          id: 'issue-2',
          key: 'API-2',
          title: 'Bug triage',
          description: 'Triage the incoming queue',
          type: 'bug',
          status: 'in_progress',
          statusName: 'In Progress',
          priority: 'medium',
          assigneeId: null,
          reporterId: 'user-1',
          organizationId: 'org-1',
          projectId: 'project-1',
          sprintId: null,
          estimate: null,
          dueDate: null,
          createdAt: '2026-04-02T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
          assignee: null,
          reporter: null,
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useIssues>);
  });

  it('renders unified view tabs and applies a saved view to filters and tab state', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (
        url === '/api/projects/project-1/views?teamId=team-1' &&
        (!init || !init.method || init.method === 'GET')
      ) {
        return {
          ok: true,
          json: async () => ({
            viewerId: 'user-1',
            project: {
              id: 'project-1',
              key: 'API',
              name: 'API Platform',
              teamId: 'team-1',
            },
            views: [
              {
                id: 'view-1',
                name: 'Release Board',
                description: 'Board focus',
                query: 'project = API',
                criteria: {
                  search: 'release',
                  priority: ['high'],
                },
                isPublic: true,
                isStarred: false,
                viewType: 'board',
                lastUsedAt: null,
                updatedAt: '2026-04-01T00:00:00.000Z',
                scope: 'teamspace',
                teamspaceId: 'team-1',
                isDefault: false,
                isOwned: true,
                userId: 'user-1',
              },
            ],
          }),
        } as Response;
      }

      if (url === '/api/saved-filters/view-1/use') {
        return {
          ok: true,
          json: async () => ({}),
        } as Response;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderWithQueryClient(<ProjectViewsShell projectId="project-1" />);

    expect(await screen.findByText('Views')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Calendar' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /^Release Board/i }));

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board')).toHaveTextContent('board:project-1:release');
    });

    expect(screen.getByTestId('filters-search')).toHaveTextContent('release');
    expect(fetchMock).toHaveBeenCalledWith('/api/saved-filters/view-1/use', { method: 'POST' });
  });

  it('saves the current view with normalized criteria and active teamspace context', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (
        url === '/api/projects/project-1/views?teamId=team-1' &&
        (!init || !init.method || init.method === 'GET')
      ) {
        return {
          ok: true,
          json: async () => ({
            viewerId: 'user-1',
            project: {
              id: 'project-1',
              key: 'API',
              name: 'API Platform',
              teamId: 'team-1',
            },
            views: [],
          }),
        } as Response;
      }

      if (url === '/api/projects/project-1/views' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            id: 'view-new',
          }),
        } as Response;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderWithQueryClient(<ProjectViewsShell projectId="project-1" />);

    await screen.findByText('Views');

    await user.click(screen.getByRole('tab', { name: 'Calendar' }));
    await user.click(screen.getByRole('button', { name: /Save view/i }));
    await user.type(screen.getByLabelText('View name'), 'Weekly planning');
    await user.type(screen.getByLabelText('Description'), 'Calendar-first teamspace view');
    await user.click(screen.getByRole('checkbox', { name: /Set as default view/i }));
    await user.click(screen.getByRole('button', { name: /^Save view$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => url === '/api/projects/project-1/views' && init?.method === 'POST'
        )
      ).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/projects/project-1/views' && init?.method === 'POST'
    );

    expect(postCall).toBeDefined();
    const requestBody = JSON.parse(String(postCall?.[1]?.body ?? '{}'));

    expect(requestBody).toMatchObject({
      name: 'Weekly planning',
      description: 'Calendar-first teamspace view',
      scope: 'teamspace',
      isPinned: true,
      isDefault: true,
      viewType: 'calendar',
      query: 'project = API',
    });

    expect(requestBody.criteria).toMatchObject({
      search: '',
      priority: [],
      assignee: [],
      labels: [],
      teamspaceId: 'team-1',
      groupBy: null,
      visibleColumns: ['key', 'title', 'status', 'priority', 'assignee', 'dueDate'],
      sort: {
        field: 'dueDate',
        direction: 'desc',
      },
    });
  });

  it('shows a localized permission message when saving a view is denied', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (
        url === '/api/projects/project-1/views?teamId=team-1' &&
        (!init || !init.method || init.method === 'GET')
      ) {
        return {
          ok: true,
          json: async () => ({
            viewerId: 'user-1',
            project: {
              id: 'project-1',
              key: 'API',
              name: 'API Platform',
              teamId: 'team-1',
            },
            views: [],
          }),
        } as Response;
      }

      if (url === '/api/projects/project-1/views' && init?.method === 'POST') {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: 'Forbidden' }),
        } as Response;
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    const user = userEvent.setup();
    renderWithQueryClient(<ProjectViewsShell projectId="project-1" />);

    await screen.findByText('Views');

    await user.click(screen.getByRole('button', { name: /Save view/i }));
    await user.type(screen.getByLabelText('View name'), 'Restricted view');
    await user.click(screen.getByRole('button', { name: /^Save view$/i }));

    expect(
      await screen.findByText("You don't have permission to view that page.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Forbidden$/i)).not.toBeInTheDocument();
  });
});
