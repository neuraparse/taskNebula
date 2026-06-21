import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { InitiativeDetailClient } from '../initiative-detail-client';

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('InitiativeDetailClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a localized access error instead of staying on loading when the API denies access', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    }) as jest.MockedFunction<typeof fetch>;

    renderWithQueryClient(<InitiativeDetailClient initiativeId="init-denied" />);

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to view that page.")).toBeInTheDocument();
    expect(screen.queryByText('Loading initiative...')).not.toBeInTheDocument();
  });

  it('renders the initiative detail after access is confirmed by the API', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/initiatives/init-1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            initiative: {
              id: 'init-1',
              name: 'Migration program',
              description: null,
              status: 'planned',
              targetDate: null,
              color: null,
              workspaceId: 'org-1',
            },
            projects: [],
            children: [],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          url.endsWith('/roll-up')
            ? { done: 0, total: 0, percent: 0, projectCount: 0, perProject: [] }
            : { updates: [] },
      } as Response;
    }) as jest.MockedFunction<typeof fetch>;

    renderWithQueryClient(<InitiativeDetailClient initiativeId="init-1" />);

    expect(await screen.findByRole('heading', { name: /migration program/i })).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });
});
