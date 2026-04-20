import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    render(<OrganizationSwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Acme Corp');
    });
  });

  it('lists the available organizations when the trigger is opened', async () => {
    const user = userEvent.setup();

    render(<OrganizationSwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Acme Corp');
    });

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: /Globex/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Acme Corp/ })).toBeInTheDocument();
  });

  it('updates the current organization when a different option is selected', async () => {
    const user = userEvent.setup();
    const setSpy = jest.spyOn(useOrganization.getState(), 'setCurrentOrganization');

    render(<OrganizationSwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Acme Corp');
    });

    await user.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: /Globex/ });
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

    render(<OrganizationSwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /No organizations/i })).toBeDisabled();
    });
  });

  it('hides the organization list while the fetch is in-flight (loading state)', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(pending);

    render(<OrganizationSwitcher />);

    expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();

    // Cleanup: resolve the pending fetch to avoid act() warnings on unmount.
    resolveFetch({ ok: true, json: async () => ({ organizations }) });
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});
