import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamspaceManager } from '../teamspace-manager';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationMembers } from '@/lib/hooks/use-members';
import {
  useAddTeamspaceMember,
  useCreateTeamspace,
  useDeleteTeamspace,
  useRemoveTeamspaceMember,
  useTeamspaceMembers,
  useTeamspaces,
  useUpdateTeamspace,
  useUpdateTeamspaceMember,
} from '@/lib/hooks/use-teamspaces';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-members', () => ({
  useOrganizationMembers: jest.fn(),
}));

jest.mock('@/lib/hooks/use-teamspaces', () => ({
  useTeamspaces: jest.fn(),
  useTeamspaceMembers: jest.fn(),
  useCreateTeamspace: jest.fn(),
  useUpdateTeamspace: jest.fn(),
  useDeleteTeamspace: jest.fn(),
  useAddTeamspaceMember: jest.fn(),
  useUpdateTeamspaceMember: jest.fn(),
  useRemoveTeamspaceMember: jest.fn(),
}));

const mockUseOrganizationMembers = useOrganizationMembers as jest.MockedFunction<typeof useOrganizationMembers>;
const mockUseTeamspaces = useTeamspaces as jest.MockedFunction<typeof useTeamspaces>;
const mockUseTeamspaceMembers = useTeamspaceMembers as jest.MockedFunction<typeof useTeamspaceMembers>;
const mockUseCreateTeamspace = useCreateTeamspace as jest.MockedFunction<typeof useCreateTeamspace>;
const mockUseUpdateTeamspace = useUpdateTeamspace as jest.MockedFunction<typeof useUpdateTeamspace>;
const mockUseDeleteTeamspace = useDeleteTeamspace as jest.MockedFunction<typeof useDeleteTeamspace>;
const mockUseAddTeamspaceMember = useAddTeamspaceMember as jest.MockedFunction<typeof useAddTeamspaceMember>;
const mockUseUpdateTeamspaceMember = useUpdateTeamspaceMember as jest.MockedFunction<typeof useUpdateTeamspaceMember>;
const mockUseRemoveTeamspaceMember = useRemoveTeamspaceMember as jest.MockedFunction<typeof useRemoveTeamspaceMember>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('TeamspaceManager', () => {
  const createMutateAsync = jest.fn();

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
      currentTeamId: 'team-1',
    });

    mockUseTeamspaces.mockReturnValue({
      data: [
        {
          id: 'team-1',
          organizationId: 'org-1',
          name: 'Platform',
          slug: 'platform',
          description: 'Core platform work',
          avatarUrl: null,
          leadId: 'user-1',
          settings: {},
          isMember: true,
          memberCount: 3,
          projectCount: 2,
          currentUserRole: 'lead',
          lead: {
            id: 'user-1',
            name: 'Bayram',
            email: 'bayram@example.com',
            image: null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useTeamspaces>);

    mockUseOrganizationMembers.mockReturnValue({
      data: {
        members: [
          {
            id: 'user-1',
            name: 'Bayram',
            email: 'bayram@example.com',
            image: null,
            status: 'active',
            role: 'owner',
            memberStatus: 'active',
            joinedAt: new Date().toISOString(),
          },
        ],
        userRole: 'owner',
        isSuperAdmin: false,
      },
    } as ReturnType<typeof useOrganizationMembers>);

    mockUseTeamspaceMembers.mockReturnValue({
      data: {
        team: { id: 'team-1', name: 'Platform' },
        members: [],
      },
      isLoading: false,
    } as ReturnType<typeof useTeamspaceMembers>);

    mockUseCreateTeamspace.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as ReturnType<typeof useCreateTeamspace>);

    mockUseUpdateTeamspace.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateTeamspace>);
    mockUseDeleteTeamspace.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as ReturnType<typeof useDeleteTeamspace>);
    mockUseAddTeamspaceMember.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as ReturnType<typeof useAddTeamspaceMember>);
    mockUseUpdateTeamspaceMember.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as ReturnType<typeof useUpdateTeamspaceMember>);
    mockUseRemoveTeamspaceMember.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as ReturnType<typeof useRemoveTeamspaceMember>);
  });

  it('renders the current teamspaces with their planning metadata', () => {
    render(
      <Wrapper>
        <TeamspaceManager organizationId="org-1" canManage />
      </Wrapper>
    );

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Core platform work')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens the create dialog and submits the normalized payload', async () => {
    const user = userEvent.setup();
    createMutateAsync.mockResolvedValue({ team: { id: 'team-2' } });

    render(
      <Wrapper>
        <TeamspaceManager organizationId="org-1" canManage />
      </Wrapper>
    );

    await user.click(screen.getByRole('button', { name: /new teamspace/i }));
    await user.type(screen.getByLabelText('Name'), 'Growth Ops');
    await user.type(screen.getByLabelText('Description'), 'Demand generation and funnel planning');
    await user.click(screen.getByRole('button', { name: /create teamspace/i }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        name: 'Growth Ops',
        slug: 'growth-ops',
        description: 'Demand generation and funnel planning',
        avatarUrl: undefined,
        leadId: null,
      });
    });
  });
});
