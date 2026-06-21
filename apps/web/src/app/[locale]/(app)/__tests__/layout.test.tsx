import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import AppLayout from '../layout';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { currentUserHasWorkspaceAccess } from '@/lib/auth/workspace-access';
import { redirect } from 'next/navigation';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  isSuperAdmin: jest.fn(),
}));

jest.mock('@/lib/auth/workspace-access', () => ({
  currentUserHasWorkspaceAccess: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string) => key),
}));

jest.mock('@/components/layout/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

jest.mock('@/components/layout/app-header', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));

jest.mock('@/components/layout/app-ui-scope', () => ({
  AppUiScope: () => null,
}));

jest.mock('@/components/layout/route-transition', () => ({
  RouteTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/layout/page-sidebar-slot', () => ({
  PageSidebarSlotProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/chat/global-voice-provider', () => ({
  GlobalVoiceProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/command/command-palette-provider', () => ({
  CommandPaletteProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/help/keyboard-shortcuts-provider', () => ({
  KeyboardShortcutsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ai/ai-sidecar-provider', () => ({
  AiSidecarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/auth/email-verification-banner', () => ({
  EmailVerificationBanner: () => null,
}));

jest.mock('@/components/mobile/mobile-nav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

jest.mock('@/components/admin/global-version-update-banner', () => ({
  GlobalVersionUpdateBanner: () => <div data-testid="version-banner" />,
}));

const authMock = auth as jest.MockedFunction<typeof auth>;
const isSuperAdminMock = isSuperAdmin as jest.MockedFunction<typeof isSuperAdmin>;
const currentUserHasWorkspaceAccessMock = currentUserHasWorkspaceAccess as jest.MockedFunction<
  typeof currentUserHasWorkspaceAccess
>;
const redirectMock = redirect as unknown as jest.MockedFunction<(url: string) => never>;

async function renderLayout() {
  render(
    await AppLayout({
      children: <div data-testid="page-content" />,
    })
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects anonymous users before rendering authenticated app chrome', async () => {
    authMock.mockResolvedValue(null);

    await expect(renderLayout()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/auth/signin');
    expect(isSuperAdminMock).not.toHaveBeenCalled();
    expect(currentUserHasWorkspaceAccessMock).not.toHaveBeenCalled();
  });

  it('renders app chrome for authenticated users', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01T00:00:00.000Z' });
    isSuperAdminMock.mockResolvedValue(true);
    currentUserHasWorkspaceAccessMock.mockResolvedValue(true);

    await renderLayout();

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    expect(screen.getByTestId('version-banner')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('does not render the global update banner for non-super-admin users', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01T00:00:00.000Z' });
    isSuperAdminMock.mockResolvedValue(false);
    currentUserHasWorkspaceAccessMock.mockResolvedValue(true);

    await renderLayout();

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('version-banner')).not.toBeInTheDocument();
  });
});
