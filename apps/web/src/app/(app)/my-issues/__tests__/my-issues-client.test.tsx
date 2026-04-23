/**
 * Tests for MyIssuesClient — the /my-issues route component.
 *
 * Covers:
 *   - default view is "assigned" when no ?view= param is set, and renders
 *     issues fetched from /api/issues/my-issues with view=assigned
 *   - changing the view (?view=created, ?view=subscribed, ?view=mentioned)
 *     refetches with the correct query string and re-renders the issue list
 *   - empty state renders the appropriate "no issues" message per view
 */

import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyIssuesClient } from '../my-issues-client';

// ---------------------------------------------------------------------------
// next-auth mock — MyIssuesClient gates the query on session?.user?.id.
// ---------------------------------------------------------------------------
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } }, status: 'authenticated' }),
}));

// ---------------------------------------------------------------------------
// next/navigation mock — we need a mutable searchParams so we can flip views.
// ---------------------------------------------------------------------------
let currentSearchParamsString = '';
const getSearchParams = () => new URLSearchParams(currentSearchParamsString);

// The router.replace spy also mirrors what Next.js really does — it mutates the
// URL so the next useSearchParams() read reflects the new query string.
const replaceSpy = jest.fn((href: string) => {
  const q = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  currentSearchParamsString = q;
});
const pushSpy = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceSpy, push: pushSpy }),
  usePathname: () => '/my-issues',
  useSearchParams: () => getSearchParams(),
}));

// ---------------------------------------------------------------------------
// Issue detail modal — not under test. Render a placeholder.
// ---------------------------------------------------------------------------
jest.mock('@/components/issues/issue-detail-modal', () => ({
  IssueDetailModal: ({ issueId }: { issueId: string }) => (
    <div data-testid="issue-detail-modal">{issueId}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Fetch mock — route hits /api/issues/my-issues?view=<scope>.
// ---------------------------------------------------------------------------
type MockIssue = {
  id: string;
  key: string;
  title: string;
  priority: string;
  statusId: string;
  projectId: string;
  status: { name: string; category: string; color: string };
  project: { key: string; name: string };
  updatedAt?: string;
};

const issuesByView: Record<string, MockIssue[]> = {
  assigned: [
    {
      id: 'issue-a1',
      key: 'API-1',
      title: 'Ship the release',
      priority: 'high',
      statusId: 'status-1',
      projectId: 'project-1',
      status: { name: 'Todo', category: 'todo', color: '#64748b' },
      project: { key: 'API', name: 'API Platform' },
    },
  ],
  created: [
    {
      id: 'issue-c1',
      key: 'API-2',
      title: 'Bug: broken login',
      priority: 'critical',
      statusId: 'status-2',
      projectId: 'project-1',
      status: { name: 'In Progress', category: 'in_progress', color: '#3b82f6' },
      project: { key: 'API', name: 'API Platform' },
    },
  ],
  subscribed: [
    {
      id: 'issue-s1',
      key: 'WEB-3',
      title: 'Watching this one',
      priority: 'medium',
      statusId: 'status-3',
      projectId: 'project-2',
      status: { name: 'In Review', category: 'in_review', color: '#8b5cf6' },
      project: { key: 'WEB', name: 'Web' },
    },
  ],
  mentioned: [],
};

const fetchCalls: string[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  replaceSpy.mockClear();
  pushSpy.mockClear();
  currentSearchParamsString = '';

  // @ts-expect-error — global fetch is augmented for the jsdom test env.
  global.fetch = jest.fn(async (url: string) => {
    fetchCalls.push(url);
    const view = new URL(url, 'http://localhost').searchParams.get('view') || 'assigned';
    const payload = issuesByView[view] ?? [];
    return {
      ok: true,
      status: 200,
      json: async () => ({ issues: payload, view }),
    } as unknown as Response;
  });
});

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('MyIssuesClient', () => {
  it('renders the assigned view by default and hits /api/issues/my-issues?view=assigned', async () => {
    renderWithQueryClient(<MyIssuesClient />);

    await waitFor(() => {
      expect(screen.getByText('Ship the release')).toBeInTheDocument();
    });

    // The header reports 1 issue.
    expect(screen.getByText('1 issue')).toBeInTheDocument();
    // Fetch was called with the assigned view.
    expect(fetchCalls.some((u) => u.includes('view=assigned'))).toBe(true);
  });

  it('switching view query param changes the rendered issue list', async () => {
    currentSearchParamsString = 'view=created';
    renderWithQueryClient(<MyIssuesClient />);

    await waitFor(() => {
      expect(screen.getByText('Bug: broken login')).toBeInTheDocument();
    });
    expect(fetchCalls.some((u) => u.includes('view=created'))).toBe(true);

    // User clicks the "Subscribed" tab.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Subscribed' }));

    await waitFor(() => {
      expect(screen.getByText('Watching this one')).toBeInTheDocument();
    });
    expect(fetchCalls.some((u) => u.includes('view=subscribed'))).toBe(true);
    // handleScopeChange must push the new view into the URL via router.replace.
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.stringContaining('view=subscribed'),
      expect.objectContaining({ scroll: false })
    );
  });

  it('renders the empty state with the correct copy when no issues are returned', async () => {
    currentSearchParamsString = 'view=mentioned';
    renderWithQueryClient(<MyIssuesClient />);

    await waitFor(() => {
      expect(screen.getByText('No mentions yet')).toBeInTheDocument();
    });
    expect(screen.getByText('0 issues')).toBeInTheDocument();
  });
});

// Silence unused-import-in-production-build warning from userEvent/act bundles.
void act;
