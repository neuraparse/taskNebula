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

/** Ensures /api/organizations/org-1/members GET returns an owner-role payload
 *  so the Invite button is enabled. */
function installMembersListFetch(overrides?: {
  invitePostHandler?: (body: string) => { ok: boolean; status?: number; payload: unknown };
}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.includes('/members') && (!init || init.method === undefined || init.method === 'GET')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          members: [],
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
  installMembersListFetch();
});

describe('MembersPageClient — invite with project assignment', () => {
  it('(a) renders the invite form with email field, role selector, and a project picker section', async () => {
    const user = userEvent.setup();
    renderWithClient(<MembersPageClient />);

    // Wait for the members query to settle so the Invite button is enabled.
    const inviteTrigger = await screen.findByRole('button', { name: /invite/i });
    expect(inviteTrigger).toBeEnabled();

    await user.click(inviteTrigger);

    // Dialog opens: email input, role label, and project picker region.
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/role/i)).toBeInTheDocument();

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
    await user.click(inviteTrigger);

    // Try to open the project picker trigger (may be a button or combobox).
    // We look for anything that mentions "project" and click through.
    const dialog = await screen.findByRole('dialog');
    const pickerTriggerCandidates = within(dialog).queryAllByRole('button');
    const pickerTrigger = pickerTriggerCandidates.find((btn) =>
      /project|add|select|pick/i.test(btn.textContent ?? '')
    );
    if (pickerTrigger && pickerTrigger.textContent?.toLowerCase().includes('project')) {
      await user.click(pickerTrigger);
    }

    await waitFor(
      () => {
        // Either rendered inline or via popover — project names must appear.
        expect(screen.getByText(/alpha/i)).toBeInTheDocument();
        expect(screen.getByText(/beta/i)).toBeInTheDocument();
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
    await user.click(inviteTrigger);

    // Fill email.
    const emailInput = await screen.findByLabelText(/email/i);
    await user.type(emailInput, 'new@example.com');

    // Try to select a project via the picker. We attempt best-effort: click
    // something that says "project" then click "Alpha". If the peer's picker
    // isn't wired yet, this branch may no-op — the subsequent assertion
    // specifically targets the projectIds field in the request body.
    const dialog = await screen.findByRole('dialog');
    const pickerTrigger = within(dialog)
      .queryAllByRole('button')
      .find((btn) => /project|add.*project|select.*project/i.test(btn.textContent ?? ''));
    if (pickerTrigger) {
      await user.click(pickerTrigger);
      const alphaOption = await screen.findByText(/alpha/i);
      await user.click(alphaOption);
    }

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
  });

  it('(d) with no projects selected, projectIds is omitted or an empty array', async () => {
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

    // Contract: either projectIds is absent, or it's an empty array.
    const projectIds = parsed.projectIds;
    expect(projectIds === undefined || (Array.isArray(projectIds) && projectIds.length === 0)).toBe(
      true
    );
  });
});
