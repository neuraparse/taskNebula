import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationSwitcher } from '../organization-switcher';
import { useOrganization } from '@/lib/hooks/use-organization';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const organizations = [
  { id: 'org-1', name: 'Acme Corp', slug: 'acme', role: 'owner' },
  { id: 'org-2', name: 'Globex', slug: 'globex', role: 'member' },
];

function renderSwitcher() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizationSwitcher />
    </QueryClientProvider>
  );
}

describe('OrganizationSwitcher', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organizations }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    (global.fetch as jest.Mock).mockReset?.();
  });

  it('renders the current organization name once loaded', async () => {
    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Acme Corp');
    });
  });

  it('lists the available organizations when the trigger is opened', async () => {
    const user = userEvent.setup();

    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Acme Corp');
    });

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('menuitem', { name: /Globex/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Acme Corp/ })).toBeInTheDocument();
  });

  it('updates the current organization when a different option is selected', async () => {
    const user = userEvent.setup();
    const setSpy = jest.spyOn(useOrganization.getState(), 'setCurrentOrganization');

    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Acme Corp');
    });

    await user.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('menuitem', { name: /Globex/ });
    await user.click(option);

    await waitFor(() => {
      expect(useOrganization.getState().currentOrganizationId).toBe('org-2');
    });

    setSpy.mockRestore();
  });

  it('shows a disabled "No organizations" button when list is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ organizations: [] }),
    });

    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Select org');
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByRole('menuitem', { name: /No organizations/i })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('hides the organization list while the fetch is in-flight (loading state)', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(pending);

    renderSwitcher();

    expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();

    // Cleanup: resolve the pending fetch to avoid act() warnings on unmount.
    resolveFetch({ ok: true, json: async () => ({ organizations }) });
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});
