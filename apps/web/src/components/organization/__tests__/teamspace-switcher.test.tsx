import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamspaceSwitcher } from '../teamspace-switcher';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationPermissions } from '@/lib/hooks/use-permissions';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';

const pushMock = jest.fn();

jest.mock('@/lib/hooks/use-teamspaces', () => ({
  useTeamspaces: jest.fn(),
}));

jest.mock('@/lib/hooks/use-permissions', () => ({
  useOrganizationPermissions: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const mockUseTeamspaces = useTeamspaces as jest.MockedFunction<typeof useTeamspaces>;
const mockUseOrganizationPermissions = useOrganizationPermissions as jest.MockedFunction<
  typeof useOrganizationPermissions
>;

describe('TeamspaceSwitcher', () => {
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
    pushMock.mockReset();
    localStorage.clear();
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });
    mockUseTeamspaces.mockReset().mockReturnValue({
      data: [
        {
          id: 'team-1',
          organizationId: 'org-1',
          name: 'Platform',
          slug: 'platform',
          description: 'Platform work',
          avatarUrl: null,
          leadId: null,
          settings: {},
          isMember: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'team-2',
          organizationId: 'org-1',
          name: 'Growth',
          slug: 'growth',
          description: 'Growth experiments',
          avatarUrl: null,
          leadId: null,
          settings: {},
          isMember: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useTeamspaces>);
    mockUseOrganizationPermissions.mockReset().mockReturnValue({
      permissions: ['org:settings'],
      isSuperAdmin: false,
      role: 'admin',
      isLoading: false,
      has: jest.fn((permission) => permission === 'org:settings'),
      hasAny: jest.fn((permissions) => permissions.includes('org:settings')),
      hasAll: jest.fn((permissions) =>
        permissions.every((permission) => permission === 'org:settings')
      ),
    });
  });

  it('shows the active teamspace label when one is selected', () => {
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: 'team-2',
    });

    render(<TeamspaceSwitcher />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Growth');
  });

  it('lets the user switch to a specific teamspace and back to all teamspaces', async () => {
    const user = userEvent.setup();

    render(<TeamspaceSwitcher />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('All Teamspaces');

    await user.click(trigger);
    await user.click(screen.getByText('Platform'));

    await waitFor(() => {
      expect(useOrganization.getState().currentTeamId).toBe('team-1');
    });

    expect(screen.getByRole('combobox')).toHaveTextContent('Platform');

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('All Teamspaces'));

    await waitFor(() => {
      expect(useOrganization.getState().currentTeamId).toBeNull();
    });

    expect(screen.getByRole('combobox')).toHaveTextContent('All Teamspaces');
  });

  it('clears a stale teamspace when it is no longer part of the organization payload', async () => {
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: 'missing-team',
    });

    render(<TeamspaceSwitcher />);

    await waitFor(() => {
      expect(useOrganization.getState().currentTeamId).toBeNull();
    });

    expect(screen.getByRole('combobox')).toHaveTextContent('All Teamspaces');
  });

  it('links to teamspace management from the switcher menu', async () => {
    const user = userEvent.setup();

    render(<TeamspaceSwitcher />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Manage teamspaces'));

    expect(pushMock).toHaveBeenCalledWith('/settings/organization?tab=teamspaces');
  });

  it('hides teamspace management when the user lacks org settings permission', async () => {
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: ['team:view'],
      isSuperAdmin: false,
      role: 'member',
      isLoading: false,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    const user = userEvent.setup();
    render(<TeamspaceSwitcher />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.queryByText('Manage teamspaces')).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
