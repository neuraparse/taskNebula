import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../command-palette';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useDocumentSearch } from '@/lib/hooks/use-docs';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-docs', () => ({
  useDocumentSearch: jest.fn(),
}));

const mockUseDocumentSearch = useDocumentSearch as jest.MockedFunction<typeof useDocumentSearch>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('CommandPalette', () => {
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
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });

    mockUseDocumentSearch.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useDocumentSearch>);
  });

  const openWithShortcut = () => {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      );
    });
  };

  it('opens the palette when the user presses ctrl+k', async () => {
    render(
      <Wrapper>
        <CommandPalette />
      </Wrapper>
    );

    // Not mounted yet
    expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();

    openWithShortcut();

    expect(await screen.findByPlaceholderText('Type a command or search...')).toBeInTheDocument();
  });

  it('renders the default quick actions and navigation items when open', async () => {
    render(
      <Wrapper>
        <CommandPalette />
      </Wrapper>
    );

    openWithShortcut();

    expect(await screen.findByRole('option', { name: /Create Issue/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Settings/i })).toBeInTheDocument();
  });

  it('filters results down when the user types a query', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CommandPalette />
      </Wrapper>
    );

    openWithShortcut();

    const input = await screen.findByPlaceholderText('Type a command or search...');
    await user.type(input, 'dashboard');

    expect(await screen.findByRole('option', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Settings$/i })).not.toBeInTheDocument();
  });

  it('navigates via router.push when a navigation item is selected', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CommandPalette />
      </Wrapper>
    );

    openWithShortcut();

    const option = await screen.findByRole('option', { name: /Dashboard/i });
    await user.click(option);

    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });

  it('toggles closed when the shortcut is pressed while open', async () => {
    render(
      <Wrapper>
        <CommandPalette />
      </Wrapper>
    );

    openWithShortcut();

    expect(await screen.findByPlaceholderText('Type a command or search...')).toBeInTheDocument();

    openWithShortcut();

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Type a command or search...')).not.toBeInTheDocument();
    });
  });
});
