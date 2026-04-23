import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const useIssueMock = jest.fn();
jest.mock('@/lib/hooks/use-issues', () => ({
  useIssue: (id: string | null) => useIssueMock(id),
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
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
