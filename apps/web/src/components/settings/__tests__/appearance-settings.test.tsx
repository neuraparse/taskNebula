import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { AppearanceSettings } from '../appearance-settings';
import { useThemeStore } from '@/lib/stores/theme-store';

const mockSetTheme = jest.fn();
let mockTheme: 'light' | 'dark' | 'system' | undefined = 'dark';

jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

const originalFetch = global.fetch;

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function mockAppearanceFetch(settings: Record<string, unknown>) {
  global.fetch = jest.fn(async () => {
    return {
      ok: true,
      json: async () => ({ settings }),
    } as Response;
  }) as unknown as typeof fetch;
}

function getAppearancePutCalls() {
  return ((global.fetch as jest.Mock).mock.calls as [string, RequestInit | undefined][]).filter(
    ([, init]) => init?.method === 'PUT'
  );
}

describe('AppearanceSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockTheme = 'dark';
    mockUseTheme.mockImplementation(
      () =>
        ({
          theme: mockTheme,
          setTheme: mockSetTheme,
        }) as ReturnType<typeof useTheme>
    );
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1' } },
      status: 'authenticated',
      update: jest.fn(),
    } as unknown as ReturnType<typeof useSession>);
    useThemeStore.setState({
      colorTheme: 'rose',
      visualStyle: 'glass',
      interfaceFont: 'ibm',
      enableAnimations: false,
      enableGradients: false,
      hydrated: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps the local color mode when the server only returns first-run defaults', async () => {
    mockAppearanceFetch({
      userId: 'user-1',
      theme: 'system',
      colorTheme: 'default',
      visualStyle: 'modern',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: true,
      updatedAt: null,
    });

    renderWithQueryClient(<AppearanceSettings />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/appearance');
    });

    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(useThemeStore.getState().colorTheme).toBe('rose');
    expect(useThemeStore.getState().visualStyle).toBe('glass');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(getAppearancePutCalls()).toHaveLength(0);
  });

  it('keeps an explicit local color mode over a saved server system value and syncs it', async () => {
    localStorage.setItem('tasknebula-color-mode', 'light');
    mockTheme = 'light';
    mockAppearanceFetch({
      userId: 'user-1',
      theme: 'system',
      colorTheme: 'default',
      visualStyle: 'modern',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: true,
      updatedAt: '2026-06-23T04:00:00.000Z',
    });

    renderWithQueryClient(<AppearanceSettings />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/appearance');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
    expect(mockSetTheme).not.toHaveBeenCalledWith('system');

    await waitFor(() => {
      expect(getAppearancePutCalls()).toHaveLength(1);
    });

    const [, init] = getAppearancePutCalls()[0];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      theme: 'light',
    });
  });

  it('uses a saved server light mode instead of a stale local default system value', async () => {
    localStorage.setItem('tasknebula-color-mode', 'system');
    mockTheme = 'system';
    mockAppearanceFetch({
      userId: 'user-1',
      theme: 'light',
      colorTheme: 'default',
      visualStyle: 'modern',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: true,
      updatedAt: '2026-06-23T04:00:00.000Z',
    });

    renderWithQueryClient(<AppearanceSettings />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    expect(mockSetTheme).toHaveBeenCalledWith('light');
    expect(localStorage.getItem('tasknebula-color-mode')).toBe('light');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(getAppearancePutCalls()).toHaveLength(0);
  });

  it('saves an explicit local color mode when the server only has first-run defaults', async () => {
    localStorage.setItem('tasknebula-color-mode', 'dark');
    mockTheme = 'dark';
    mockAppearanceFetch({
      userId: 'user-1',
      theme: 'system',
      colorTheme: 'default',
      visualStyle: 'modern',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: true,
      updatedAt: null,
    });

    renderWithQueryClient(<AppearanceSettings />);

    await waitFor(() => {
      expect(getAppearancePutCalls()).toHaveLength(1);
    });

    const [, init] = getAppearancePutCalls()[0];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      theme: 'dark',
    });
  });

  it('writes the selected color mode to local storage immediately', async () => {
    mockTheme = 'system';
    mockAppearanceFetch({
      userId: 'user-1',
      theme: 'system',
      colorTheme: 'default',
      visualStyle: 'modern',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: true,
      updatedAt: '2026-06-23T04:00:00.000Z',
    });

    renderWithQueryClient(<AppearanceSettings />);

    await waitFor(() => {
      expect(localStorage.getItem('tasknebula-color-mode')).toBe('system');
    });

    fireEvent.click(screen.getByRole('button', { name: /light/i }));

    expect(localStorage.getItem('tasknebula-color-mode')).toBe('light');
    expect(mockSetTheme).toHaveBeenCalledWith('light');

    await waitFor(() => {
      expect(getAppearancePutCalls()).toHaveLength(1);
    });
    const [, init] = getAppearancePutCalls()[0];
    expect(JSON.parse(init?.body as string)).toMatchObject({
      theme: 'light',
    });
  });

  it('applies a persisted server color mode and appearance row', async () => {
    mockAppearanceFetch({
      userId: 'user-1',
      theme: 'light',
      colorTheme: 'purple',
      visualStyle: 'minimal',
      interfaceFont: 'ibm',
      animationsEnabled: true,
      gradientsEnabled: true,
      updatedAt: '2026-06-23T04:00:00.000Z',
    });

    renderWithQueryClient(<AppearanceSettings />);

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });
    expect(useThemeStore.getState().colorTheme).toBe('purple');
    expect(useThemeStore.getState().visualStyle).toBe('minimal');
  });
});
