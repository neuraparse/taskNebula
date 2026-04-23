import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
//
// The settings page switches on a ?tab= query param and mounts a manager
// component per tab. The managers themselves are covered elsewhere; here we
// only care that the page:
//   (a) renders the default tab (organization) when no ?tab is present,
//   (b) mounts the correct manager when ?tab= is specified,
//   (c) shows a loading placeholder when the organization is not yet
//       resolved (the only guard the page has — there is no explicit
//       "unauthorized" branch in the page itself, that lives in the
//       /api/* handlers).
//
// To keep the test hermetic we stub every child so we can assert *which*
// manager mounted without dragging in the real data hooks.

const mockUseOrganization = jest.fn<{ currentOrganizationId: string | null }, []>();
jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => mockUseOrganization(),
}));

jest.mock('@/lib/hooks/use-ai-feature', () => ({
  useAiFeature: () => ({ aiEnabled: true }),
}));

const mockSearchParamsGet = jest.fn<string | null, [string]>();
const mockRouterReplace = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ replace: mockRouterReplace, push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: () => '',
  }),
}));

jest.mock('@/components/settings/api-keys-manager', () => ({
  ApiKeysManager: () => <div data-testid="manager-api-keys">api-keys</div>,
}));
jest.mock('@/components/settings/webhooks-manager', () => ({
  WebhooksManager: () => <div data-testid="manager-webhooks">webhooks</div>,
}));
jest.mock('@/components/audit/audit-log-viewer', () => ({
  AuditLogViewer: () => <div data-testid="manager-audit-log">audit-log</div>,
}));
jest.mock('@/components/settings/notification-preferences', () => ({
  NotificationPreferences: () => <div data-testid="manager-notifications">notifications</div>,
}));
jest.mock('@/components/settings/appearance-settings', () => ({
  AppearanceSettings: () => <div data-testid="manager-appearance">appearance</div>,
}));
jest.mock('@/components/settings/organization-ai-agents', () => ({
  OrganizationAiAgentsSettings: () => <div data-testid="manager-ai-agents">ai-agents</div>,
}));
jest.mock('@/components/settings/organization-communications-settings', () => ({
  OrganizationCommunicationsSettings: () => <div data-testid="manager-communications">communications</div>,
}));
jest.mock('../members/members-page-client', () => ({
  MembersPageClient: () => <div data-testid="manager-members">members</div>,
}));
jest.mock('../organization/organization-settings-client', () => ({
  OrganizationSettingsClient: () => <div data-testid="manager-organization">organization</div>,
}));

// The page is a client component, so import after mocks are in place.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import SettingsPage from '../page';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockUseOrganization.mockReturnValue({ currentOrganizationId: 'org-test' });
  mockSearchParamsGet.mockReturnValue(null);
  mockRouterReplace.mockClear();
});

describe('SettingsPage (/settings)', () => {
  it('renders the Organization manager as the default tab when no ?tab is specified', () => {
    mockSearchParamsGet.mockReturnValue(null);

    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId('manager-organization')).toBeInTheDocument();
    // None of the other manager stubs should be mounted.
    expect(screen.queryByTestId('manager-api-keys')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-webhooks')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-ai-agents')).not.toBeInTheDocument();
  });

  it('mounts the matching manager when ?tab= points at a valid tab', () => {
    mockSearchParamsGet.mockImplementation((key) => (key === 'tab' ? 'webhooks' : null));

    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId('manager-webhooks')).toBeInTheDocument();
    expect(screen.queryByTestId('manager-organization')).not.toBeInTheDocument();
  });

  it('shows a loading placeholder instead of any manager when the organization has not resolved yet', () => {
    // No current organization — mirrors the "not a member of any workspace" /
    // session-still-loading state. The page returns a loading stub and does
    // not mount any manager (which would then blow up against /api/* without
    // an org ID).
    mockUseOrganization.mockReturnValue({ currentOrganizationId: null });
    mockSearchParamsGet.mockImplementation((key) => (key === 'tab' ? 'api-keys' : null));

    renderWithProviders(<SettingsPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId('manager-api-keys')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-organization')).not.toBeInTheDocument();
  });
});
