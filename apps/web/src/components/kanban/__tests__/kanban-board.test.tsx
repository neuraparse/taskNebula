import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { KanbanBoard } from '../kanban-board';
import type { Issue } from '@/lib/hooks/use-issues';
import type { WorkflowStatus } from '@/lib/hooks/use-workflow-statuses';

// --- Hook mocks ---------------------------------------------------------

jest.mock('@/lib/hooks/use-issues', () => ({
  useIssues: jest.fn(),
  useUpdateIssue: jest.fn(() => ({ mutate: jest.fn() })),
}));

jest.mock('@/lib/hooks/use-workflow-statuses', () => ({
  useWorkflowStatuses: jest.fn(),
}));

// Minimal no-op modal mocks so the board can render without deep trees.
jest.mock('@/components/issues/issue-detail-modal', () => ({
  IssueDetailModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="issue-detail-modal" /> : null,
}));

jest.mock('@/components/issues/create-issue-modal', () => ({
  CreateIssueModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-issue-modal" /> : null,
}));

jest.mock('../add-column-dialog', () => ({
  AddColumnDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-column-dialog" /> : null,
}));

import { useIssues, useUpdateIssue } from '@/lib/hooks/use-issues';
import { useWorkflowStatuses } from '@/lib/hooks/use-workflow-statuses';

const mockedUseIssues = useIssues as unknown as jest.Mock;
const mockedUseUpdateIssue = useUpdateIssue as unknown as jest.Mock;
const mockedUseWorkflowStatuses = useWorkflowStatuses as unknown as jest.Mock;

// --- Fixtures -----------------------------------------------------------

const mockStatuses: WorkflowStatus[] = [
  { id: 'st-todo', name: 'To Do', category: 'backlog', color: '#94a3b8', position: 0 },
  { id: 'st-doing', name: 'In Progress', category: 'in_progress', color: '#3b82f6', position: 1 },
  { id: 'st-done', name: 'Done', category: 'done', color: '#10b981', position: 2 },
];

const mockIssue: Issue = {
  id: 'issue-1',
  key: 'DEMO-1',
  title: 'First issue',
  description: null,
  type: 'task',
  status: 'in_progress',
  statusId: 'st-doing',
  priority: 'medium',
  assigneeId: null,
  reporterId: 'user-1',
  organizationId: 'org-1',
  projectId: 'project-1',
  sprintId: null,
  estimate: null,
  labels: [],
  dueDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  assignee: null,
  reporter: null,
};

// --- Helpers ------------------------------------------------------------

function renderBoard(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseUpdateIssue.mockReturnValue({ mutate: jest.fn() });
});

// --- Tests --------------------------------------------------------------

describe('KanbanBoard', () => {
  it('renders columns derived from workflow statuses and the matching issue', () => {
    mockedUseWorkflowStatuses.mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    });
    mockedUseIssues.mockReturnValue({
      data: [mockIssue],
      isLoading: false,
      error: null,
    });

    renderBoard(<KanbanBoard projectId="project-1" />);

    // All workflow statuses render as column headers.
    expect(screen.getByRole('heading', { name: 'To Do' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();

    // The issue card renders with its key and title.
    expect(screen.getByText('DEMO-1')).toBeInTheDocument();
    expect(screen.getByText('First issue')).toBeInTheDocument();
  });

  it('renders columns with empty state when the project has no issues', () => {
    mockedUseWorkflowStatuses.mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    });
    mockedUseIssues.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderBoard(<KanbanBoard projectId="project-1" />);

    // All columns still render.
    expect(screen.getByRole('heading', { name: 'To Do' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();

    // Each column shows its "No issues" empty state.
    expect(screen.getAllByText('No issues')).toHaveLength(mockStatuses.length);
  });

  it('surfaces issue key fields on the rendered card', () => {
    const assigned: Issue = {
      ...mockIssue,
      id: 'issue-2',
      key: 'DEMO-42',
      title: 'Ship the board',
      priority: 'high',
      type: 'story',
      statusId: 'st-todo',
      status: 'backlog',
      assigneeId: 'user-9',
      assignee: {
        id: 'user-9',
        name: 'Jane Doe',
        email: 'jane@example.com',
        image: null,
      },
    };

    mockedUseWorkflowStatuses.mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    });
    mockedUseIssues.mockReturnValue({
      data: [assigned],
      isLoading: false,
      error: null,
    });

    renderBoard(<KanbanBoard projectId="project-1" />);

    expect(screen.getByText('DEMO-42')).toBeInTheDocument();
    expect(screen.getByText('Ship the board')).toBeInTheDocument();
    // Type chip renders capitalized (css: `capitalize`) but the text content is 'story'.
    expect(screen.getByText('story')).toBeInTheDocument();
  });
});
