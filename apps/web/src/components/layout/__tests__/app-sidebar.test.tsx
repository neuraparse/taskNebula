import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { AppSidebar } from '../app-sidebar';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjects } from '@/lib/hooks/use-projects';
import { useLiveCalls } from '@/lib/hooks/use-chat';
import { useGlobalVoice } from '@/components/chat/global-voice-provider';
import { useStoredVoicePreferences } from '@/lib/chat/voice-preferences';
import { usePageSidebarHasContent } from '@/components/layout/page-sidebar-slot';
import { useOrganizationPermissions } from '@/lib/hooks/use-permissions';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

// ---------- Mocks ----------

let mockPathname = '/dashboard';
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: jest.fn(),
  };
});

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: jest.fn(),
}));

jest.mock('@/lib/hooks/use-projects', () => ({
  useProjects: jest.fn(),
}));

jest.mock('@/lib/hooks/use-chat', () => ({
  useLiveCalls: jest.fn(),
}));

jest.mock('@/components/chat/global-voice-provider', () => ({
  useGlobalVoice: jest.fn(),
}));

jest.mock('@/lib/chat/voice-preferences', () => ({
  useStoredVoicePreferences: jest.fn(),
}));

jest.mock('@/components/layout/page-sidebar-slot', () => ({
  PageSidebarSlotTarget: () => null,
  usePageSidebarHasContent: jest.fn(),
}));

jest.mock('@/lib/hooks/use-permissions', () => ({
  useOrganizationPermissions: jest.fn(),
}));

jest.mock('@/components/layout/app-rail', () => ({
  AppRail: () => <div data-testid="app-rail" />,
}));

jest.mock('@/components/organization/teamspace-switcher', () => ({
  TeamspaceSwitcher: () => <div data-testid="teamspace-switcher" />,
}));

jest.mock('@/components/branding/tasknebula-logo', () => ({
  TaskNebulaLogo: () => <div data-testid="tasknebula-logo" />,
}));

// livekit hooks are only used when a voice session is active; stub defensively
jest.mock('@livekit/components-react', () => ({
  RoomContext: { Provider: ({ children }: { children: ReactNode }) => <>{children}</> },
  useAudioPlayback: () => ({ canPlayAudio: true, startAudio: jest.fn() }),
  useConnectionState: () => 'disconnected',
  useIsSpeaking: () => false,
  useLocalParticipant: () => ({ localParticipant: { identity: 'local', audioLevel: 0 } }),
  useParticipants: () => [],
  useRoomContext: () => ({}),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseOrganization = useOrganization as unknown as jest.Mock;
const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;
const mockUseLiveCalls = useLiveCalls as jest.MockedFunction<typeof useLiveCalls>;
const mockUseGlobalVoice = useGlobalVoice as jest.MockedFunction<typeof useGlobalVoice>;
const mockUseStoredVoicePreferences = useStoredVoicePreferences as jest.MockedFunction<
  typeof useStoredVoicePreferences
>;
const mockUsePageSidebarHasContent = usePageSidebarHasContent as jest.MockedFunction<
  typeof usePageSidebarHasContent
>;
const mockUseOrganizationPermissions = useOrganizationPermissions as jest.MockedFunction<
  typeof useOrganizationPermissions
>;

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function setIsSuperAdmin(isSuperAdmin: boolean) {
  mockUseQuery.mockReturnValue({
    data: { isSuperAdmin },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useQuery>);
}

function setPathname(path: string) {
  mockPathname = path;
}

function setSearchParams(params: Record<string, string> = {}) {
  Array.from(mockSearchParams.keys()).forEach((key) => mockSearchParams.delete(key));
  Object.entries(params).forEach(([key, value]) => mockSearchParams.set(key, value));
}

describe('AppSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSearchParams();

    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', name: 'Ada', email: 'ada@example.com', image: null } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);

    mockUseOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });

    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    mockUseLiveCalls.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useLiveCalls>);

    mockUseGlobalVoice.mockReturnValue({
      connectionState: 'disconnected',
      currentSession: null,
      currentTarget: null,
      endCurrentCall: jest.fn(),
      isMicrophoneEnabled: false,
      isTogglingMicrophone: false,
      leaveCurrentCall: jest.fn(),
      participantCount: 0,
      room: null,
      runtimeError: null,
      setAudioDeviceId: jest.fn(),
      toggleMicrophone: jest.fn(),
    } as unknown as ReturnType<typeof useGlobalVoice>);

    mockUseStoredVoicePreferences.mockReturnValue({
      storedAudioDeviceGroupId: null,
      storedAudioDeviceId: 'default',
      storedAudioDeviceLabel: null,
      storeAudioDeviceId: jest.fn(),
      storeAudioDevicePreference: jest.fn(),
    } as unknown as ReturnType<typeof useStoredVoicePreferences>);

    mockUsePageSidebarHasContent.mockReturnValue(false);
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: 'owner',
      isLoading: false,
      has: jest.fn(() => true),
      hasAny: jest.fn(() => true),
      hasAll: jest.fn(() => true),
    });

    setIsSuperAdmin(false);
  });

  it('renders DASHBOARD_LINKS on /dashboard (Overview, Drafts, Templates)', () => {
    setPathname('/dashboard');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /drafts/i })).toHaveAttribute('href', '/drafts');
    expect(screen.getByRole('link', { name: /templates/i })).toHaveAttribute('href', '/templates');
  });

  it('renders DASHBOARD_LINKS on /drafts (so users can navigate back home)', () => {
    setPathname('/drafts');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /drafts/i })).toHaveAttribute('href', '/drafts');
    expect(screen.getByRole('link', { name: /templates/i })).toHaveAttribute('href', '/templates');
  });

  it('renders DASHBOARD_LINKS on /templates', () => {
    setPathname('/templates');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /drafts/i })).toHaveAttribute('href', '/drafts');
    expect(screen.getByRole('link', { name: /templates/i })).toHaveAttribute('href', '/templates');
  });

  it('renders MY_ISSUES_VIEWS on /issues/[issueId] detail pages', () => {
    setPathname('/issues/abc-123');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /assigned to me/i })).toHaveAttribute(
      'href',
      '/my-issues?view=assigned'
    );
    expect(screen.getByRole('link', { name: /created by me/i })).toHaveAttribute(
      'href',
      '/my-issues?view=created'
    );
  });

  it('renders MY_ISSUES_VIEWS when the route has a locale prefix', () => {
    setPathname('/tr/my-issues');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /assigned to me/i })).toHaveAttribute(
      'href',
      '/my-issues?view=assigned'
    );
    expect(screen.getByRole('link', { name: /created by me/i })).toHaveAttribute(
      'href',
      '/my-issues?view=created'
    );
  });

  it('renders Inbox filters on /inbox and keeps the section separate from My Issues', () => {
    setPathname('/inbox');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /assigned to me/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^all$/i })).toHaveAttribute('href', '/inbox');
    expect(screen.getByRole('link', { name: /unread only/i })).toHaveAttribute(
      'href',
      '/inbox?unread=1'
    );
    expect(screen.getByRole('link', { name: /agents/i })).toHaveAttribute(
      'href',
      '/inbox?actor=agent'
    );
    expect(screen.getByRole('link', { name: /webhooks/i })).toHaveAttribute(
      'href',
      '/inbox?actor=webhook'
    );
  });

  it('marks the matching Inbox filter active from query params', () => {
    setPathname('/inbox');
    setSearchParams({ actor: 'agent' });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /agents/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /^all$/i })).not.toHaveAttribute('data-active');
  });

  it('marks Team links active from tab query params', () => {
    setPathname('/team');
    setSearchParams({ tab: 'teamspaces' });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /teamspaces/i })).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(screen.getByRole('link', { name: /^members$/i })).not.toHaveAttribute('data-active');
  });

  it('renders SETTINGS_LINKS on /settings (Organization, Members, API Keys, Labels, Integrations, Activity)', () => {
    setPathname('/settings');

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /organization/i })).toHaveAttribute(
      'href',
      '/settings?tab=organization'
    );
    expect(screen.getByRole('link', { name: /members/i })).toHaveAttribute(
      'href',
      '/settings?tab=members'
    );
    expect(screen.getByRole('link', { name: /api keys/i })).toHaveAttribute(
      'href',
      '/settings?tab=api-keys'
    );
    expect(screen.getByRole('link', { name: /webhooks/i })).toHaveAttribute(
      'href',
      '/settings?tab=webhooks'
    );
    expect(screen.getByRole('link', { name: /^labels$/i })).toHaveAttribute(
      'href',
      '/settings?tab=labels'
    );
    expect(screen.getByRole('link', { name: /integrations/i })).toHaveAttribute(
      'href',
      '/settings/integrations'
    );
    expect(screen.getByRole('link', { name: /notifications/i })).toHaveAttribute(
      'href',
      '/settings?tab=notifications'
    );
    expect(screen.getByRole('link', { name: /appearance/i })).toHaveAttribute(
      'href',
      '/settings?tab=appearance'
    );
    expect(screen.getByRole('link', { name: /activity/i })).toHaveAttribute(
      'href',
      '/settings?tab=audit-log'
    );
  });

  it('keeps admin navigation out of the settings sidebar even for super admins', () => {
    setPathname('/settings');
    setIsSuperAdmin(true);

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /organization/i })).toHaveAttribute(
      'href',
      '/settings?tab=organization'
    );
    expect(screen.queryByRole('link', { name: /feature flags/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /agent control/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^system$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /audit logs/i })).not.toBeInTheDocument();
  });

  it('limits settings navigation to personal appearance when the user has no workspace access', () => {
    setPathname('/settings');

    render(
      <Wrapper>
        <AppSidebar hasWorkspaceAccess={false} />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /appearance/i })).toHaveAttribute(
      'href',
      '/settings?tab=appearance'
    );
    expect(screen.queryByRole('link', { name: /organization/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^members$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^labels$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /api keys/i })).not.toBeInTheDocument();
  });

  it('hides permission-gated settings links while organization permissions are loading', () => {
    setPathname('/settings');
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: null,
      isLoading: true,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /^labels$/i })).toHaveAttribute(
      'href',
      '/settings?tab=labels'
    );
    expect(screen.getByRole('link', { name: /notifications/i })).toHaveAttribute(
      'href',
      '/settings?tab=notifications'
    );
    expect(screen.getByRole('link', { name: /appearance/i })).toHaveAttribute(
      'href',
      '/settings?tab=appearance'
    );
    expect(screen.queryByRole('link', { name: /organization/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^members$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /api keys/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /webhooks/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ai & agents/i })).not.toBeInTheDocument();
  });

  it('hides team links while organization permissions are loading', () => {
    setPathname('/team');
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: null,
      isLoading: true,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.queryByRole('link', { name: /^members$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /teamspaces/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pending invites/i })).not.toBeInTheDocument();
  });

  it('shows only teamspaces in team navigation when the user has team:view without member:view', () => {
    setPathname('/team');
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: ['team:view'],
      isSuperAdmin: false,
      role: 'guest',
      isLoading: false,
      has: jest.fn((permission) => permission === 'team:view'),
      hasAny: jest.fn((permissions) => permissions.includes('team:view')),
      hasAll: jest.fn((permissions) =>
        permissions.every((permission) => permission === 'team:view')
      ),
    });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /teamspaces/i })).toHaveAttribute(
      'href',
      '/team?tab=teamspaces'
    );
    expect(screen.queryByRole('link', { name: /^members$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pending invites/i })).not.toBeInTheDocument();
  });

  it('hides the dashboard teamspace switcher when the user lacks team:view', () => {
    setPathname('/dashboard');
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: 'member',
      isLoading: false,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.queryByTestId('teamspace-switcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /teamspaces/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  it('shows the dashboard teamspace switcher when the user has team:view', () => {
    setPathname('/dashboard');
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: ['team:view'],
      isSuperAdmin: false,
      role: 'member',
      isLoading: false,
      has: jest.fn((permission) => permission === 'team:view'),
      hasAny: jest.fn((permissions) => permissions.includes('team:view')),
      hasAll: jest.fn((permissions) =>
        permissions.every((permission) => permission === 'team:view')
      ),
    });

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByTestId('teamspace-switcher')).toBeInTheDocument();
  });

  it('does not fetch or render project navigation when the user has no workspace access', () => {
    setPathname('/dashboard');

    render(
      <Wrapper>
        <AppSidebar hasWorkspaceAccess={false} />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /drafts/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /templates/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('teamspace-switcher')).not.toBeInTheDocument();
    expect(screen.queryByText(/no projects yet/i)).not.toBeInTheDocument();
    expect(mockUseProjects).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('does not render ADMIN_LINKS when isSuperAdmin is false', () => {
    setPathname('/settings');
    setIsSuperAdmin(false);

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    // Admin-only links must not appear on the /settings page when not super admin
    expect(screen.queryByRole('link', { name: /feature flags/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /agent control/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^system$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^updates$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /realtime health/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /audit logs/i })).not.toBeInTheDocument();
  });

  it('renders only ADMIN_LINKS on /admin when isSuperAdmin is true', () => {
    setPathname('/admin');
    setIsSuperAdmin(true);

    render(
      <Wrapper>
        <AppSidebar />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /organizations/i })).toHaveAttribute(
      'href',
      '/admin?tab=organizations'
    );
    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute(
      'href',
      '/admin?tab=users'
    );
    expect(screen.getByRole('link', { name: /feature flags/i })).toHaveAttribute(
      'href',
      '/admin?tab=feature-flags'
    );
    expect(screen.getByRole('link', { name: /agent control/i })).toHaveAttribute(
      'href',
      '/admin?tab=agents'
    );
    expect(screen.getByRole('link', { name: /^system$/i })).toHaveAttribute(
      'href',
      '/admin?tab=system'
    );
    expect(screen.getByRole('link', { name: /^updates$/i })).toHaveAttribute(
      'href',
      '/admin?tab=updates'
    );
    expect(screen.getByRole('link', { name: /realtime health/i })).toHaveAttribute(
      'href',
      '/admin?tab=realtime'
    );
    expect(screen.getByRole('link', { name: /audit logs/i })).toHaveAttribute(
      'href',
      '/admin?tab=audit'
    );
    expect(screen.queryByRole('link', { name: /api keys/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /webhooks/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^labels$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /appearance/i })).not.toBeInTheDocument();
  });
});
