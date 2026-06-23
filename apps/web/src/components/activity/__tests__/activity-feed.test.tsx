import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ActivityFeed } from '../activity-feed';

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activities: [
          {
            id: 'activity-1',
            action: 'issue.status_changed',
            type: 'status_change',
            messageKey: 'movedTo',
            messageValues: { status: 'In Review' },
            user: {
              id: 'user-1',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              image: null,
            },
            issue: {
              id: 'issue-1',
              key: 'TN-7',
              title: 'Localize activity feed',
            },
            createdAt: '2026-06-23T10:00:00.000Z',
          },
          {
            id: 'activity-2',
            action: 'issue.priority_changed',
            type: 'updated',
            messageKey: 'changedPriorityTo',
            messageValues: { priority: 'high' },
            user: {
              id: 'user-2',
              name: 'Grace Hopper',
              email: 'grace@example.com',
              image: null,
            },
            issue: null,
            createdAt: '2026-06-22T10:00:00.000Z',
          },
        ],
      }),
    } as Response);
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete (global as typeof globalThis & { fetch?: typeof fetch }).fetch;
  });

  it('renders localized message descriptors from recent activity API data', async () => {
    renderWithQueryClient(<ActivityFeed organizationId="org-1" />);

    expect(await screen.findByText('moved to In Review')).toBeInTheDocument();
    expect(screen.getByText('changed priority to High')).toBeInTheDocument();
    expect(screen.getByText('TN-7')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/activities/recent?organizationId=org-1&limit=20'
    );
  });
});
