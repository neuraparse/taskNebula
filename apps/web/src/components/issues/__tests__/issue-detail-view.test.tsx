import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiResponseError } from '@/lib/client-api-errors';

// Mock child components to keep this test focused on branching in IssueDetailView
jest.mock('../issue-header', () => ({
  IssueHeader: ({ issue }: { issue: { title: string } }) => (
    <div data-testid="issue-header">{issue.title}</div>
  ),
}));
jest.mock('../issue-content', () => ({
  IssueContent: () => <div data-testid="issue-content" />,
}));
jest.mock('../issue-activity', () => ({
  IssueActivity: () => <div data-testid="issue-activity" />,
}));
jest.mock('../issue-sidebar', () => ({
  IssueSidebar: () => <div data-testid="issue-sidebar" />,
}));
jest.mock('../time-in-status-panel', () => ({
  TimeInStatusPanel: () => <div data-testid="time-in-status-panel" />,
}));
jest.mock('../time-tracking-panel', () => ({
  TimeTrackingPanel: () => <div data-testid="time-tracking-panel" />,
}));
jest.mock('../issue-triage-panel', () => ({
  IssueTriagePanel: () => <div data-testid="issue-triage-panel" />,
}));
jest.mock('../issue-quick-actions', () => ({
  IssueQuickActions: () => <div data-testid="issue-quick-actions" />,
}));

const useIssueMock = jest.fn();
const deleteMutateMock = jest.fn();
jest.mock('@/lib/hooks/use-issues', () => ({
  useIssue: (id: string | null) => useIssueMock(id),
  useDeleteIssue: () => ({ mutate: deleteMutateMock, isPending: false }),
}));

const useAiCapabilityMock = jest.fn();
jest.mock('@/lib/hooks/use-ai-capability', () => ({
  useAiCapability: () => useAiCapabilityMock(),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

import { IssueDetailView } from '../issue-detail-view';

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockIssue = {
  id: 'issue-1',
  key: 'API-42',
  title: 'Ship new feature',
  description: 'Do the thing',
  type: 'task',
  status: 'in_progress',
  statusId: 'status-2',
  priority: 'high',
  assigneeId: null,
  reporterId: 'user-1',
  organizationId: 'org-1',
  projectId: 'project-1',
  sprintId: null,
  estimate: 3,
  labels: [],
  dueDate: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
};

describe('IssueDetailView', () => {
  beforeEach(() => {
    useIssueMock.mockReset();
    deleteMutateMock.mockReset();
    useAiCapabilityMock.mockReset();
    useAiCapabilityMock.mockReturnValue({ canRunAgents: false, isLoading: false });
  });

  it('renders issue title and child panels when data resolves', () => {
    useIssueMock.mockReturnValue({
      data: mockIssue,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="issue-1" />
      </Wrapper>
    );

    expect(screen.getByTestId('issue-header')).toHaveTextContent('Ship new feature');
    expect(screen.getByTestId('issue-content')).toBeInTheDocument();
    expect(screen.getByTestId('issue-activity')).toBeInTheDocument();
    expect(screen.getByTestId('issue-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('issue-quick-actions')).toBeInTheDocument();
    // Time tracking section is open by default, so the panel mounts immediately.
    expect(screen.getByTestId('time-tracking-panel')).toBeInTheDocument();

    const sidebarColumn = screen.getByTestId('issue-sidebar').parentElement?.parentElement;
    expect(sidebarColumn).toHaveClass('min-w-0', 'border-t', 'lg:border-l', 'lg:border-t-0');
    const detailGrid = sidebarColumn?.parentElement;
    expect(detailGrid).toHaveClass('lg:grid-cols-[minmax(0,1fr)_320px]');
    expect(detailGrid?.parentElement).toHaveClass('overflow-visible', 'lg:overflow-hidden');
    expect(detailGrid?.parentElement?.parentElement).toHaveClass(
      'overflow-y-auto',
      'lg:overflow-hidden'
    );
  });

  it('hides the AI triage section when the AI capability is disabled', () => {
    useIssueMock.mockReturnValue({
      data: mockIssue,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="issue-1" />
      </Wrapper>
    );

    expect(screen.queryByRole('button', { name: /ai triage/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('issue-triage-panel')).not.toBeInTheDocument();
  });

  it('shows the AI triage section (collapsed by default) when agents can run', () => {
    useAiCapabilityMock.mockReturnValue({ canRunAgents: true, isLoading: false });
    useIssueMock.mockReturnValue({
      data: mockIssue,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="issue-1" />
      </Wrapper>
    );

    const toggle = screen.getByRole('button', { name: /ai triage/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('issue-triage-panel')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('issue-triage-panel')).toBeInTheDocument();
  });

  it('collapses and re-opens the time tracking section', () => {
    useIssueMock.mockReturnValue({
      data: mockIssue,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="issue-1" />
      </Wrapper>
    );

    const toggle = screen.getByRole('button', { name: /time tracking/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.queryByTestId('time-tracking-panel')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByTestId('time-tracking-panel')).toBeInTheDocument();
  });

  it('shows a "not found" state when the issue is null (404)', () => {
    useIssueMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="missing-id" />
      </Wrapper>
    );

    expect(screen.getByText(/issue not found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('issue-header')).not.toBeInTheDocument();
  });

  it('shows an error state when the query errors', () => {
    useIssueMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="issue-1" />
      </Wrapper>
    );

    expect(screen.getByText(/failed to load issue/i)).toBeInTheDocument();
    expect(screen.getByText(/refresh the page or try again/i)).toBeInTheDocument();
    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
  });

  it('shows a localized permission message when the issue API denies access', () => {
    useIssueMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiResponseError('Forbidden', 403, 'FORBIDDEN'),
      refetch: jest.fn(),
    });

    const Wrapper = wrapper();
    render(
      <Wrapper>
        <IssueDetailView issueId="issue-1" />
      </Wrapper>
    );

    expect(screen.getByText(/failed to load issue/i)).toBeInTheDocument();
    expect(screen.getByText(/you don't have permission to view that page/i)).toBeInTheDocument();
    expect(screen.queryByText(/^forbidden$/i)).not.toBeInTheDocument();
  });
});
