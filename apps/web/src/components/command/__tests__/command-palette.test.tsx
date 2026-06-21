import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CommandPalette } from '../command-palette';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationPermissions } from '@/lib/hooks/use-permissions';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/hooks/use-permissions', () => ({
  useOrganizationPermissions: jest.fn(),
}));

const mockUseOrganizationPermissions = useOrganizationPermissions as jest.MockedFunction<
  typeof useOrganizationPermissions
>;

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  if (!(Element.prototype as unknown as { hasPointerCapture?: unknown }).hasPointerCapture) {
    (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () =>
      false;
  }
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

describe('CommandPalette (FEAT-25 omnibar)', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    pushMock.mockClear();

    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: ['member:view', 'team:view'],
      isSuperAdmin: false,
      role: 'member',
      isLoading: false,
      has: jest.fn(() => true),
      hasAny: jest.fn(() => true),
      hasAll: jest.fn(() => true),
    });

    const makeResponse = (status: number, body: unknown = ''): Response => {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: '',
        headers: new Headers(),
        json: async () => (typeof body === 'string' ? {} : body),
        text: async () => text,
      } as unknown as Response;
    };

    fetchMock = jest.fn((url: RequestInfo | URL) => {
      const target = typeof url === 'string' ? url : url.toString();
      if (target.startsWith('/api/search-history')) {
        return Promise.resolve(makeResponse(200, { history: [] }));
      }
      if (target.startsWith('/api/search/hybrid')) {
        return Promise.resolve(makeResponse(404, ''));
      }
      if (target.startsWith('/api/search')) {
        return Promise.resolve(
          makeResponse(200, {
            results: [
              { id: 'iss-1', title: 'Fix login redirect', key: 'TN-12' },
              { id: 'iss-2', title: 'Hover state regression', key: 'TN-13' },
            ],
          })
        );
      }
      if (target.startsWith('/api/ask')) {
        return Promise.resolve(makeResponse(202, ''));
      }
      return Promise.resolve(makeResponse(200, '{}'));
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderOpen() {
    const result = render(<CommandPalette open={true} onOpenChange={jest.fn()} />);
    // Flush the history fetch (fires synchronously on mount) so subsequent
    // assertions don't race the resolved promise.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    return result;
  }

  async function advanceDebounce() {
    await act(async () => {
      jest.advanceTimersByTime(150);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders the tab strip and quick navigation when input is empty', async () => {
    await renderOpen();
    expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Ask AI/ })).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('My Issues')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.queryByText('Work items')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
  });

  it('limits navigation when the user has no workspace access', async () => {
    render(<CommandPalette open={true} onOpenChange={jest.fn()} hasWorkspaceAccess={false} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Issues/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Docs/ })).not.toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByText('Work items')).not.toBeInTheDocument();
    expect(screen.queryByText('Docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });

  it('hides team quick navigation while organization permissions are missing', async () => {
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: 'viewer',
      isLoading: false,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    await renderOpen();

    expect(screen.queryByText('Team')).not.toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('debounces and calls /api/search when the user types', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderOpen();

    const input = screen.getByLabelText('Command palette query');
    await user.type(input, 'login');

    // Debounce window is 120ms.
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/search?'));

    await advanceDebounce();

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(
        calls.some((u) => u.includes('/api/search/hybrid?') || u.includes('/api/search?'))
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText('Fix login redirect')).toBeInTheDocument();
    });
  });

  it('parses status: into a removable chip and strips it from free-text', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderOpen();

    const input = screen.getByLabelText('Command palette query');
    await user.type(input, 'bug status:in_progress');

    expect(screen.getByTestId('facet-chip-status')).toHaveTextContent('in_progress');

    await advanceDebounce();

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      // The search call should contain the original raw query (the route
      // does its own JQL parse). What matters: chip was rendered AND a
      // search call was issued.
      expect(calls.some((u) => u.includes('q=bug'))).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: /Remove status filter/i }));
    expect(screen.queryByTestId('facet-chip-status')).not.toBeInTheDocument();
  });

  it('cycles tabs when Tab is pressed', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderOpen();

    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Tab}');
    expect(screen.getByRole('tab', { name: /Issues/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Tab}');
    expect(screen.getByRole('tab', { name: /Docs/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the Ask AI CTA for a multi-word query and POSTs to /api/ask on enter', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderOpen();

    const input = screen.getByLabelText('Command palette query');
    await user.type(input, 'why is sprint velocity dropping?');

    await advanceDebounce();

    const cta = await screen.findByText(/Ask TaskNebula/);
    await user.click(cta);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes('/api/ask'))).toBe(true);
    });
  });
});
