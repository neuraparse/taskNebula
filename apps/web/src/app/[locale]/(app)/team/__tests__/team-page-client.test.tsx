import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { TeamPageClient } from '../team-page-client';
import { useOrganizationMembers } from '@/lib/hooks/use-members';

const replaceMock = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/team',
  useSearchParams: () => mockSearchParams,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

jest.mock('@/lib/hooks/use-members', () => ({
  useOrganizationMembers: jest.fn(),
}));

// Stub the TeamspaceManager so we only test tab routing here.
jest.mock('@/components/organization/teamspace-manager', () => ({
  TeamspaceManager: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="teamspace-manager">Teamspace panel for {organizationId}</div>
  ),
}));

const mockUseOrganizationMembers = useOrganizationMembers as jest.MockedFunction<
  typeof useOrganizationMembers
>;

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const initialMembers = [
  {
    id: 'om-1',
    role: 'owner',
    user: {
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
      status: 'active',
    },
  },
  {
    id: 'om-2',
    role: 'member',
    user: {
      id: 'user-2',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      image: null,
      status: 'active',
    },
  },
];

describe('TeamPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    mockUseOrganizationMembers.mockReturnValue({
      data: {
        members: [
          {
            id: 'user-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            image: null,
            status: 'active',
            role: 'owner',
            memberStatus: 'active',
            joinedAt: new Date().toISOString(),
          },
          {
            id: 'user-2',
            name: 'Grace Hopper',
            email: 'grace@example.com',
            image: null,
            status: 'active',
            role: 'member',
            memberStatus: 'active',
            joinedAt: new Date().toISOString(),
          },
        ],
        userRole: 'owner',
        isSuperAdmin: false,
      },
    } as ReturnType<typeof useOrganizationMembers>);
  });

  it('renders the members list by default', () => {
    render(
      <Wrapper>
        <TeamPageClient
          organizationId="org-1"
          canViewMembers
          canViewTeamspaces
          canInviteMembers
          canManageTeamspaces
          initialMembers={initialMembers}
        />
      </Wrapper>
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByTestId('teamspace-manager')).not.toBeInTheDocument();
  });

  it('renders the teamspaces panel when tab=teamspaces is requested', () => {
    mockSearchParams = new URLSearchParams('tab=teamspaces');

    render(
      <Wrapper>
        <TeamPageClient
          organizationId="org-1"
          canViewMembers
          canViewTeamspaces
          canInviteMembers
          canManageTeamspaces
          initialMembers={initialMembers}
        />
      </Wrapper>
    );

    expect(screen.getByTestId('teamspace-manager')).toBeInTheDocument();
    expect(screen.getByText('Teamspace panel for org-1')).toBeInTheDocument();
  });

  it('shows the empty state on the invites tab when there are no pending invites', () => {
    mockSearchParams = new URLSearchParams('tab=invites');

    render(
      <Wrapper>
        <TeamPageClient
          organizationId="org-1"
          canViewMembers
          canViewTeamspaces
          canInviteMembers
          canManageTeamspaces
          initialMembers={initialMembers}
        />
      </Wrapper>
    );

    expect(screen.getByText('No pending invitations.')).toBeInTheDocument();
  });

  it('lists pending invites on the invites tab when some exist', () => {
    mockSearchParams = new URLSearchParams('tab=invites');
    mockUseOrganizationMembers.mockReturnValue({
      data: {
        members: [
          {
            id: 'user-3',
            name: null,
            email: 'pending@example.com',
            image: null,
            status: 'invited',
            role: 'member',
            memberStatus: 'invited',
            joinedAt: new Date().toISOString(),
          },
        ],
        userRole: 'owner',
        isSuperAdmin: false,
      },
    } as ReturnType<typeof useOrganizationMembers>);

    render(
      <Wrapper>
        <TeamPageClient
          organizationId="org-1"
          canViewMembers
          canViewTeamspaces
          canInviteMembers
          canManageTeamspaces
          initialMembers={initialMembers}
        />
      </Wrapper>
    );

    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('Invited')).toBeInTheDocument();
  });

  it('allows teamspace-only viewers to open the teamspaces tab without fetching members', () => {
    mockSearchParams = new URLSearchParams('tab=teamspaces');

    render(
      <Wrapper>
        <TeamPageClient
          organizationId="org-1"
          canViewMembers={false}
          canViewTeamspaces
          canInviteMembers={false}
          canManageTeamspaces={false}
          initialMembers={[]}
        />
      </Wrapper>
    );

    expect(screen.getByTestId('teamspace-manager')).toBeInTheDocument();
    expect(screen.getByText('Teamspace panel for org-1')).toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending invites')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite member')).not.toBeInTheDocument();
    expect(mockUseOrganizationMembers).toHaveBeenCalledWith(null);
  });
});
