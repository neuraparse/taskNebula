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
