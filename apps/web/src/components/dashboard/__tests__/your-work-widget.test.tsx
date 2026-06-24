import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { YourWorkWidget } from '../your-work-widget';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } }, status: 'authenticated' }),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({
    currentOrganizationId: 'org-1',
    currentTeamId: null,
  }),
}));

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('YourWorkWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the tab strip and issue rows constrained for narrow screens', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          issues: [
            {
              id: 'issue-1',
              key: 'MOBILE-123456',
              title: 'A very long dashboard issue title that should stay inside the card',
              priority: 'high',
              statusId: 'status-1',
              projectId: 'project-1',
              estimate: 3,
              dueDate: '2026-07-01T00:00:00Z',
              status: { name: 'In Progress', category: 'in_progress', color: '#000' },
              project: { key: 'MOB', name: 'Mobile' },
            },
          ],
        }),
      } as unknown as Response;
    }) as jest.MockedFunction<typeof fetch>;

    renderWithQueryClient(<YourWorkWidget />);

    expect(await screen.findByText(/A very long dashboard issue title/i)).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toHaveClass('grid', 'grid-cols-3');
    expect(screen.getByRole('tab', { name: /assigned/i })).toHaveClass('min-w-0', 'truncate');
    expect(screen.getByText(/A very long dashboard issue title/i).closest('a')).toHaveClass(
      'min-w-0'
    );
  });

  it('shows an access error instead of the empty state when the API denies access', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      } as unknown as Response;
    }) as jest.MockedFunction<typeof fetch>;

    renderWithQueryClient(<YourWorkWidget />);

    await waitFor(() => {
      expect(screen.getByText("You don't have permission to view that page.")).toBeInTheDocument();
    });
    expect(screen.queryByText('No items')).not.toBeInTheDocument();
  });
});
