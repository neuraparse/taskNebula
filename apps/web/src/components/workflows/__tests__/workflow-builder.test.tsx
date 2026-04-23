import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowBuilder } from '../workflow-builder';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = 'QC';
  return Wrapper;
}

describe('WorkflowBuilder (standalone /settings/workflows)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('renders the transition matrix for the project default workflow', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/workflow-transitions')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              statuses: [
                { id: 's1', name: 'To Do', category: 'backlog', color: 'gray', position: 0 },
                { id: 's2', name: 'In Progress', category: 'in_progress', color: 'blue', position: 1 },
                { id: 's3', name: 'Done', category: 'done', color: 'emerald', position: 2 },
              ],
              transitions: [
                { id: 't1', fromStatusId: 's1', toStatusId: 's2' },
              ],
            }),
        }) as unknown as Promise<Response>;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) as unknown as Promise<Response>;
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <WorkflowBuilder projectId="proj-1" />
      </Wrapper>
    );

    expect(screen.getByRole('heading', { name: /workflow & approvals/i })).toBeInTheDocument();

    await waitFor(() => {
      // Row/column headers appear once the workflow loads
      expect(screen.getAllByText('To Do').length).toBeGreaterThan(0);
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    });

    // Breadcrumb links back to the settings page
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/settings'
    );
  });
});
