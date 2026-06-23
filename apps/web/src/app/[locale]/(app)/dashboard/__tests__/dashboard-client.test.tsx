import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';

import { DashboardClient } from '../dashboard-client';
import { useOrganization } from '@/lib/hooks/use-organization';

// The real dashboard pulls in many heavy child components (Activity feed,
// several widgets, issue modals). Stub them so the test stays focused on
// the dashboard shell's own fetch + render paths.
jest.mock('@/components/activity/activity-feed', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

jest.mock('@/components/dashboard/your-work-widget', () => ({
  YourWorkWidget: () => <div data-testid="your-work-widget" />,
}));

jest.mock('@/components/dashboard/upcoming-deadlines-widget', () => ({
  UpcomingDeadlinesWidget: () => <div data-testid="upcoming-deadlines-widget" />,
}));

jest.mock('@/components/dashboard/pinned-items-widget', () => ({
  PinnedItemsWidget: () => <div data-testid="pinned-items-widget" />,
}));

jest.mock('@/components/issues/issue-detail-modal', () => ({
  IssueDetailModal: () => null,
}));

jest.mock('@/components/issues/create-issue-modal', () => ({
  CreateIssueModal: () => null,
}));

jest.mock('@/lib/hooks/use-projects', () => ({
  useProjects: () => ({ data: [] }),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@tasknebula.io' },
    },
    status: 'authenticated',
  }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const originalFetch = global.fetch;

function mockFetch(handlers: Record<string, unknown>) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [prefix, body] of Object.entries(handlers)) {
      if (url.startsWith(prefix)) {
        return Promise.resolve({
          ok: true,
          json: async () => body,
        } as Response);
      }
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    } as Response);
  }) as unknown as typeof fetch;
}

describe('DashboardClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders stats derived from the my-issues response', async () => {
    mockFetch({
      '/api/organizations': {
        organizations: [{ id: 'org-1', name: 'Acme' }],
      },
      '/api/issues/my-issues': {
        issues: [
          {
            id: 'issue-1',
            key: 'ACM-1',
            title: 'Ship dashboard refresh',
            priority: 'high',
            statusId: 'status-1',
            projectId: 'project-1',
            estimate: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: { name: 'In Progress', category: 'in_progress', color: '#000' },
            project: { key: 'ACM', name: 'Acme' },
          },
        ],
      },
    });

    render(
      <Wrapper>
        <DashboardClient />
      </Wrapper>
    );

    expect(await screen.findByText(/Welcome back, Ada/i)).toBeInTheDocument();
    expect(await screen.findByText('Ship dashboard refresh')).toBeInTheDocument();
    expect(document.querySelector('.dashboard-carbon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /my issues/i })).toHaveClass('rounded-none');
  });

  it('shows the empty state when no issues are returned', async () => {
    mockFetch({
      '/api/organizations': {
        organizations: [{ id: 'org-1', name: 'Acme' }],
      },
      '/api/issues/my-issues': { issues: [] },
    });

    render(
      <Wrapper>
        <DashboardClient />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/You're all caught up\./i)).toBeInTheDocument();
    });
  });
});
