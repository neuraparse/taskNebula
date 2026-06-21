/**
 * Tests for MembersPageClient — the new "invite with project assignment" UX.
 *
 * NOTE: A peer agent is still wiring the project picker markup into the
 * invite dialog and threading `projectIds` + `projectRole` into the POST
 * body. These tests encode the agreed-on contract for the NEW shape:
 *   - form renders email + role + project picker
 *   - available projects appear in the picker
 *   - selecting projects sends `projectIds` in the POST body
 *   - omitting projects leaves `projectIds` absent or empty
 *
 * Cases (c) and (d) will turn green once the peer lands the picker +
 * mutation body plumbing.
 */

import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const toastMock = jest.fn();
const fetchMock = jest.fn();

// ----- mocks (declared before importing the component) -----

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({
    currentOrganizationId: 'org-1',
    currentTeamId: null,
    setCurrentOrganization: jest.fn(),
    setCurrentTeam: jest.fn(),
    clearContext: jest.fn(),
  }),
}));

const useProjectsMock = jest.fn();
jest.mock('@/lib/hooks/use-projects', () => ({
  useProjects: (...args: unknown[]) => useProjectsMock(...args),
}));

const useOrganizationPermissionsMock = jest.fn();
jest.mock('@/lib/hooks/use-permissions', () => ({
  useOrganizationPermissions: (...args: unknown[]) => useOrganizationPermissionsMock(...args),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

// Radix UI portals render to document.body by default in jsdom, which the
// @testing-library/react screen queries pick up automatically.

import { MembersPageClient } from '../members-page-client';

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

  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => undefined,
  });
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function defaultUseProjectsReturn(projects: Array<{ id: string; name: string; key: string }> = []) {
  return {
    data: projects.map((p) => ({
      id: p.id,
      organizationId: 'org-1',
      teamId: null,
      key: p.key,
      name: p.name,
      description: null,
      status: 'active',
      settings: {},
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    })),
    isLoading: false,
    error: null,
  };
}

type TestMember = {
  id: string;
  name: string;
  email: string;
  image?: string;
  status: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
  memberStatus: string;
  joinedAt: string;
};

/** Ensures /api/organizations/org-1/members GET returns an owner-role payload
 *  so the Invite button is enabled. */
function installMembersListFetch(overrides?: {
  members?: TestMember[];
  invitePostHandler?: (body: string) => { ok: boolean; status?: number; payload: unknown };
  assignProjectsPostHandler?: (body: string) => { ok: boolean; status?: number; payload: unknown };
}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (
      typeof url === 'string' &&
      /\/api\/organizations\/[^/]+\/members\/[^/]+\/projects$/.test(url) &&
      init?.method === 'POST'
    ) {
      const body = typeof init.body === 'string' ? init.body : '';
      const handled = overrides?.assignProjectsPostHandler?.(body);
      return {
        ok: handled?.ok ?? true,
        status: handled?.status ?? (handled?.ok === false ? 400 : 200),
        json: async () =>
          handled?.payload ?? {
            addedToProjects: [],
            skippedProjects: [],
          },
      };
    }

    if (
      typeof url === 'string' &&
      url.includes('/members') &&
      (!init || init.method === undefined || init.method === 'GET')
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          members: overrides?.members ?? [],
          userRole: 'owner',
          isSuperAdmin: false,
        }),
      };
    }

    if (typeof url === 'string' && url.includes('/members') && init?.method === 'POST') {
      const body = typeof init.body === 'string' ? init.body : '';
      const handled = overrides?.invitePostHandler?.(body);
      if (handled) {
        return {
          ok: handled.ok,
          status: handled.status ?? (handled.ok ? 200 : 400),
          json: async () => handled.payload,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          member: {
            id: 'u-1',
            name: 'new',
            email: 'new@example.com',
            image: null,
            status: 'invited',
            role: 'member',
            memberStatus: 'invited',
            joinedAt: new Date().toISOString(),
          },
          addedToProjects: [],
          skippedProjects: [],
        }),
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  });

  global.fetch = fetchMock as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  useProjectsMock.mockReturnValue(defaultUseProjectsReturn([]));
  useOrganizationPermissionsMock.mockReturnValue({
    permissions: ['member:invite', 'member:manage', 'member:remove', 'project:manage'],
    isSuperAdmin: false,
    role: 'owner',
    isLoading: false,
    has: (permission: string) =>
      ['member:invite', 'member:manage', 'member:remove', 'project:manage'].includes(permission),
    hasAny: (permissions: string[]) =>
      permissions.some((permission) =>
        ['member:invite', 'member:manage', 'member:remove', 'project:manage'].includes(permission)
      ),
    hasAll: (permissions: string[]) =>
      permissions.every((permission) =>
        ['member:invite', 'member:manage', 'member:remove', 'project:manage'].includes(permission)
      ),
  });
  installMembersListFetch();
});

describe('MembersPageClient — invite with project assignment', () => {
  it('(a) renders the invite form with email field, role selector, and a project picker section', async () => {
    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    // Wait for the members query to settle so the Invite button is enabled.
    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    await waitFor(() => expect(inviteTrigger).toBeEnabled());

    await user.click(inviteTrigger);

    // Dialog opens: email input, role label, and project picker region.
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/^Role$/)).toBeInTheDocument();

    // Project picker: some control/section referencing projects must exist.
    // Match anything project-assignment related.
    const projectIndicator = screen.queryByText(/project/i);
    expect(projectIndicator).toBeTruthy();
  });

  it('(b) lists available projects in the picker when projects exist', async () => {
    useProjectsMock.mockReturnValue(
      defaultUseProjectsReturn([
        { id: 'proj-a', name: 'Alpha', key: 'ALPHA' },
        { id: 'proj-b', name: 'Beta', key: 'BETA' },
      ])
    );

    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    await waitFor(() => expect(inviteTrigger).toBeEnabled());
    await user.click(inviteTrigger);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /add to projects/i }));
    await user.click(within(dialog).getByRole('combobox', { name: /select projects/i }));

    await waitFor(
      () => {
        // Either rendered inline or via popover — project names must appear.
        expect(screen.getByText(/^Alpha$/)).toBeInTheDocument();
        expect(screen.getByText(/^Beta$/)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('(c) selecting a project and submitting includes projectIds in the POST body', async () => {
    useProjectsMock.mockReturnValue(
      defaultUseProjectsReturn([{ id: 'proj-a', name: 'Alpha', key: 'ALPHA' }])
    );

    let capturedBody: string | null = null;
    installMembersListFetch({
      invitePostHandler: (body) => {
        capturedBody = body;
        return {
          ok: true,
          status: 200,
          payload: {
            member: {
              id: 'u-1',
              name: 'new',
              email: 'new@example.com',
              image: null,
              status: 'invited',
              role: 'member',
              memberStatus: 'invited',
              joinedAt: new Date().toISOString(),
            },
            addedToProjects: ['proj-a'],
            skippedProjects: [],
          },
        };
      },
    });

    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    await waitFor(() => expect(inviteTrigger).toBeEnabled());
    await user.click(inviteTrigger);

    // Fill email.
    const emailInput = await screen.findByLabelText(/email/i);
    await user.type(emailInput, 'new@example.com');

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /add to projects/i }));
    await user.click(within(dialog).getByRole('combobox', { name: /select projects/i }));
    await user.click(await screen.findByText(/^Alpha$/));

    const submitBtn = await screen.findByRole('button', { name: /send invitation/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    const parsed = capturedBody ? JSON.parse(capturedBody) : {};
    expect(parsed.email).toBe('new@example.com');
    // When the peer has wired the picker, projectIds will be present with the
    // selection. We assert the NEW shape here.
    expect(parsed.projectIds).toEqual(['proj-a']);
    expect(parsed.inviteExpiresInDays).toBe(7);
  });

  it('(d) selecting an invitation expiry sends inviteExpiresInDays in the POST body', async () => {
    let capturedBody: string | null = null;
    installMembersListFetch({
      invitePostHandler: (body) => {
        capturedBody = body;
        return {
          ok: true,
          status: 200,
          payload: {
            member: {
              id: 'u-1',
              name: 'new',
              email: 'new@example.com',
              image: null,
              status: 'invited',
              role: 'member',
              memberStatus: 'invited',
              joinedAt: new Date().toISOString(),
            },
            addedToProjects: [],
            skippedProjects: [],
            inviteExpiresInDays: 30,
          },
        };
      },
    });

    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    await waitFor(() => expect(inviteTrigger).toBeEnabled());
    await user.click(inviteTrigger);

    const emailInput = await screen.findByLabelText(/email/i);
    await user.type(emailInput, 'new@example.com');

    const dialog = await screen.findByRole('dialog');
    const expiryTrigger = within(dialog)
      .getByText(/7 days/i)
      .closest('button');
    expect(expiryTrigger).not.toBeNull();
    await user.click(expiryTrigger as HTMLButtonElement);
    await user.click(await screen.findByRole('option', { name: /30 days/i }));

    await user.click(await screen.findByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    const parsed = capturedBody ? JSON.parse(capturedBody) : {};
    expect(parsed.inviteExpiresInDays).toBe(30);
  });

  it('(e) with no projects selected, projectIds is omitted or an empty array', async () => {
    useProjectsMock.mockReturnValue(
      defaultUseProjectsReturn([{ id: 'proj-a', name: 'Alpha', key: 'ALPHA' }])
    );

    let capturedBody: string | null = null;
    installMembersListFetch({
      invitePostHandler: (body) => {
        capturedBody = body;
        return {
          ok: true,
          status: 200,
          payload: {
            member: {
              id: 'u-1',
              name: 'new',
              email: 'new@example.com',
              image: null,
              status: 'invited',
              role: 'member',
              memberStatus: 'invited',
              joinedAt: new Date().toISOString(),
            },
            addedToProjects: [],
            skippedProjects: [],
          },
        };
      },
    });

    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    await waitFor(() => expect(inviteTrigger).toBeEnabled());
    await user.click(inviteTrigger);

    const emailInput = await screen.findByLabelText(/email/i);
    await user.type(emailInput, 'new@example.com');

    // Don't touch the project picker.
    const submitBtn = await screen.findByRole('button', { name: /send invitation/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    const parsed = capturedBody ? JSON.parse(capturedBody) : {};
    expect(parsed.email).toBe('new@example.com');
    expect(parsed.inviteExpiresInDays).toBe(7);

    // Contract: either projectIds is absent, or it's an empty array.
    const projectIds = parsed.projectIds;
    expect(projectIds === undefined || (Array.isArray(projectIds) && projectIds.length === 0)).toBe(
      true
    );
  });

  it('assigns an existing member to selected projects from the member row action', async () => {
    useProjectsMock.mockReturnValue(
      defaultUseProjectsReturn([
        { id: 'proj-a', name: 'Alpha', key: 'ALPHA' },
        { id: 'proj-b', name: 'Beta', key: 'BETA' },
      ])
    );

    let capturedBody: string | null = null;
    installMembersListFetch({
      members: [
        {
          id: 'user-1',
          name: 'Existing User',
          email: 'existing@example.com',
          image: undefined,
          status: 'active',
          role: 'member',
          memberStatus: 'active',
          joinedAt: '2025-01-01T00:00:00Z',
        },
      ],
      assignProjectsPostHandler: (body) => {
        capturedBody = body;
        return {
          ok: true,
          status: 200,
          payload: {
            addedToProjects: ['proj-a'],
            skippedProjects: [],
          },
        };
      },
    });

    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    expect(await screen.findByText('Existing User')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /add to projects/i }));
    await user.click(await screen.findByRole('menuitem', { name: /add to projects/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /select projects/i }));
    await user.click(await screen.findByText(/^Alpha$/));

    await user.click(within(dialog).getByRole('button', { name: /add to projects/i }));

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    const parsed = capturedBody ? JSON.parse(capturedBody) : {};
    expect(parsed).toEqual({
      projectIds: ['proj-a'],
      projectRole: 'developer',
    });
  });

  it('disables invite actions when member:invite is missing', async () => {
    useOrganizationPermissionsMock.mockReturnValue({
      permissions: ['member:view'],
      isSuperAdmin: false,
      role: 'viewer',
      isLoading: false,
      has: () => false,
      hasAny: () => false,
      hasAll: () => false,
    });

    renderWithClient(<MembersPageClient />);

    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    expect(inviteTrigger).toBeDisabled();
  });

  it('hides project assignment when project:manage is missing', async () => {
    useOrganizationPermissionsMock.mockReturnValue({
      permissions: ['member:invite'],
      isSuperAdmin: false,
      role: 'member',
      isLoading: false,
      has: (permission: string) => permission === 'member:invite',
      hasAny: (permissions: string[]) => permissions.includes('member:invite'),
      hasAll: (permissions: string[]) =>
        permissions.every((permission) => permission === 'member:invite'),
    });
    useProjectsMock.mockReturnValue(
      defaultUseProjectsReturn([{ id: 'proj-a', name: 'Alpha', key: 'ALPHA' }])
    );

    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    await waitFor(() => expect(inviteTrigger).toBeEnabled());
    await user.click(inviteTrigger);

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).queryByRole('button', { name: /add to projects/i })
    ).not.toBeInTheDocument();
  });
});
