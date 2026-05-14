/**
 * @jest-environment jsdom
 */

/**
 * Tests for the /admin route.
 *
 * (a) non-super-admin visiting /admin is redirected by the server component
 *     page.tsx before the client ever renders.
 * (b) super-admin sees the Overview section by default (no ?tab param).
 * (c) switching to ?tab=users renders the Users section.
 *
 * We mock:
 *   - @/auth and @/lib/auth/permissions for the server-page redirect test.
 *   - next/navigation (redirect, router hooks).
 *   - @tanstack/react-query useQuery/useMutation for section data sources.
 *   - Feature-flag + agent + chat hooks so nested panels render without
 *     hitting real endpoints.
 *   - The admin panels (AgentOpsPanel, IntegrationsAdminPanel,
 *     SystemCredentialsPanel, RealtimeHealthPanel) and dialogs so we only
 *     exercise the parent routing logic.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

/* -------------------------------------------------------------------------- */
/*  next/navigation mocks                                                     */
/* -------------------------------------------------------------------------- */

const redirectMock = jest.fn((_path: string) => {
  // Mirror Next.js behaviour — the real `redirect` throws so the server
  // component halts execution. We emulate that so the test can assert on
  // the thrown sentinel.
  throw new Error(`NEXT_REDIRECT:${_path}`);
});

const replaceMock = jest.fn();
let currentSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  usePathname: () => '/admin',
  useRouter: () => ({
    replace: replaceMock,
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => currentSearchParams,
}));

/* -------------------------------------------------------------------------- */
/*  Auth / permissions mocks (for the server page)                            */
/* -------------------------------------------------------------------------- */

const isSuperAdminMock = jest.fn<Promise<boolean>, []>();

jest.mock('@/lib/auth/permissions', () => ({
  isSuperAdmin: () => isSuperAdminMock(),
}));

/* -------------------------------------------------------------------------- */
/*  React Query mocks                                                         */
/* -------------------------------------------------------------------------- */

type MockQueryResult = {
  data?: unknown;
  isLoading?: boolean;
  error?: unknown;
};

const useQueryMock = jest.fn<MockQueryResult, [any]>();
const useMutationMock = jest.fn(() => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue(undefined),
  isPending: false,
}));
const invalidateQueriesMock = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => useQueryMock(opts),
  useMutation: (opts: any) => useMutationMock(opts),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

/* -------------------------------------------------------------------------- */
/*  Feature-flag / agent / chat hook mocks                                    */
/* -------------------------------------------------------------------------- */

jest.mock('@/lib/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ data: [], isLoading: false, error: null }),
  useDeleteFeatureFlag: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateFeatureFlag: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/lib/hooks/use-agents', () => ({
  useAdminAgentControl: () => ({ data: null, isLoading: false, error: null }),
  useAdminAgentStream: () => ({ data: null, isLoading: false, error: null }),
  useUpdateAdminAgentControl: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/lib/hooks/use-chat', () => ({
  useRealtimeHealth: () => ({ data: null, isLoading: false, error: null }),
}));

/* -------------------------------------------------------------------------- */
/*  Toast + dialog + sub-panel mocks                                          */
/* -------------------------------------------------------------------------- */

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/components/admin/create-feature-flag-dialog', () => ({
  CreateFeatureFlagDialog: () => null,
}));
jest.mock('@/components/admin/create-organization-admin-dialog', () => ({
  CreateOrganizationAdminDialog: () => null,
}));
jest.mock('@/components/admin/create-user-dialog', () => ({
  CreateUserDialog: () => null,
}));
jest.mock('@/components/admin/edit-feature-flag-dialog', () => ({
  EditFeatureFlagDialog: () => null,
}));
jest.mock('@/components/admin/feature-flag-runtime-test', () => ({
  FeatureFlagRuntimeTest: () => null,
}));
jest.mock('@/components/admin/edit-organization-dialog', () => ({
  EditOrganizationDialog: () => null,
}));
jest.mock('@/components/admin/edit-user-dialog', () => ({
  EditUserDialog: () => null,
}));
jest.mock('@/components/admin/agent-ops-panel', () => ({
  AgentOpsPanel: () => <div data-testid="agent-ops-panel" />,
}));
jest.mock('@/components/admin/integrations-admin-panel', () => ({
  IntegrationsAdminPanel: () => <div data-testid="integrations-panel" />,
}));
jest.mock('@/components/admin/realtime-health-panel', () => ({
  RealtimeHealthPanel: () => <div data-testid="realtime-panel" />,
}));
jest.mock('@/components/admin/system-credentials-panel', () => ({
  SystemCredentialsPanel: () => <div data-testid="system-panel" />,
}));

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('/admin route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSearchParams = new URLSearchParams();
    useQueryMock.mockImplementation(({ queryKey }) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === 'admin-stats') {
        return {
          data: {
            overview: {
              totalOrganizations: 3,
              totalUsers: 10,
              activeUsers: 7,
              superAdmins: 1,
              totalProjects: 4,
              totalIssues: 12,
              totalComments: 50,
            },
            organizations: { byStatus: {}, byPlan: {} },
            growth: { newOrganizations30d: 1, newUsers30d: 2 },
          },
          isLoading: false,
        };
      }
      if (key === 'admin-organizations') {
        return {
          data: { organizations: [], pagination: { total: 0 } },
          isLoading: false,
          error: null,
        };
      }
      if (key === 'admin-users') {
        return {
          data: {
            users: [
              {
                id: 'u1',
                name: 'Alice',
                email: 'alice@example.com',
                status: 'active',
                isSuperAdmin: false,
                organizations: [],
              },
            ],
            pagination: { total: 1 },
          },
          isLoading: false,
          error: null,
        };
      }
      if (key === 'admin-audit-logs') {
        return { data: { auditLogs: [] }, isLoading: false, error: null };
      }
      return { data: undefined, isLoading: false, error: null };
    });
  });

  describe('server-side guard (page.tsx)', () => {
    it('redirects non-super-admins to /dashboard', async () => {
      isSuperAdminMock.mockResolvedValueOnce(false);

      // Import after mocks are registered.
      const { default: AdminDashboardPage } = await import(
        '@/app/[locale]/(app)/admin/page'
      );

      await expect(AdminDashboardPage()).rejects.toThrow(
        'NEXT_REDIRECT:/dashboard'
      );
      expect(redirectMock).toHaveBeenCalledWith('/dashboard');
    });

    it('renders the admin dashboard for super-admins', async () => {
      isSuperAdminMock.mockResolvedValueOnce(true);

      const { default: AdminDashboardPage } = await import(
        '@/app/[locale]/(app)/admin/page'
      );

      const element = await AdminDashboardPage();
      expect(redirectMock).not.toHaveBeenCalled();
      expect(element).toBeTruthy();
    });
  });

  describe('client tab routing', () => {
    it('renders the Overview section by default', async () => {
      currentSearchParams = new URLSearchParams();
      const { AdminDashboardClient } = await import(
        '@/app/[locale]/(app)/admin/admin-dashboard-client'
      );

      render(<AdminDashboardClient />);

      // Header text for the Overview tab.
      expect(
        screen.getByRole('heading', { name: /overview/i })
      ).toBeInTheDocument();
      // KPI tile labels are unique to overview.
      expect(screen.getByText('Organizations')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Super admins')).toBeInTheDocument();
    });

    it('renders the Users section when ?tab=users is present', async () => {
      currentSearchParams = new URLSearchParams('tab=users');
      const { AdminDashboardClient } = await import(
        '@/app/[locale]/(app)/admin/admin-dashboard-client'
      );

      render(<AdminDashboardClient />);

      // The Users tab swaps the H1 for "Users" and renders the user row.
      expect(
        screen.getByRole('heading', { name: /^users$/i })
      ).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      // Overview-specific KPI label should not be present.
      expect(screen.queryByText('Super admins')).not.toBeInTheDocument();
    });
  });
});
