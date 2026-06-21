import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { AppRail } from '../app-rail';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useInbox } from '@/lib/hooks/use-inbox';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationPermissions } from '@/lib/hooks/use-permissions';

let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
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
  signOut: jest.fn(),
  useSession: jest.fn(),
}));

jest.mock('@/lib/hooks/use-inbox', () => ({
  useInbox: jest.fn(),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: jest.fn(),
}));

jest.mock('@/lib/hooks/use-permissions', () => ({
  useOrganizationPermissions: jest.fn(),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockUseInbox = useInbox as jest.MockedFunction<typeof useInbox>;
const mockUseOrganization = useOrganization as unknown as jest.MockedFunction<
  typeof useOrganization
>;
const mockUseOrganizationPermissions = useOrganizationPermissions as jest.MockedFunction<
  typeof useOrganizationPermissions
>;

describe('AppRail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    mockUsePathname.mockImplementation(() => mockPathname);
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Ada Lovelace', email: 'ada@example.com', image: null } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseInbox.mockReturnValue({
      data: { items: [] },
    } as unknown as ReturnType<typeof useInbox>);
    mockUseOrganization.mockReturnValue({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
      setCurrentOrganization: jest.fn(),
      setCurrentTeam: jest.fn(),
      clearContext: jest.fn(),
    });
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: ['member:view', 'team:view'],
      isSuperAdmin: false,
      role: 'member',
      isLoading: false,
      has: jest.fn(() => true),
      hasAny: jest.fn(() => true),
      hasAll: jest.fn(() => true),
    });
  });

  it('keeps rail labels inside a stable two-line slot without forced word breaks', () => {
    render(<AppRail />);

    const myIssues = screen.getByRole('link', { name: /my issues/i });
    expect(myIssues).toHaveClass('h-[50px]', 'w-12', 'justify-center');
    expect(screen.getByText('My Issues')).toHaveClass(
      'line-clamp-2',
      'h-5',
      'w-full',
      'break-normal',
      'text-center'
    );
  });

  it('marks My Issues active under locale-prefixed issue pages', () => {
    mockPathname = '/tr/issues/E2E-1';

    render(<AppRail />);

    const myIssues = screen.getByRole('link', { name: /my issues/i });
    expect(myIssues).toHaveAttribute('data-active', 'true');
    expect(myIssues).toHaveAttribute('aria-current', 'page');
  });

  it('renders a single unified account menu trigger at the bottom of the rail', () => {
    render(<AppRail />);

    const accountMenu = screen.getByRole('button', {
      name: /account menu for ada lovelace/i,
    });

    expect(accountMenu).toHaveClass('h-9', 'w-9', 'ring-1');
  });

  it('hides workspace navigation when the user has no workspace access', () => {
    render(<AppRail hasWorkspaceAccess={false} />);

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('link', { name: /my issues/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /projects/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /docs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /team/i })).not.toBeInTheDocument();
    expect(mockUseInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('hides the Team rail item when the user lacks team/member permissions', () => {
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: 'viewer',
      isLoading: false,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    render(<AppRail />);

    expect(screen.queryByRole('link', { name: /team/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('hides permission-gated rail items while organization permissions are loading', () => {
    mockUseOrganizationPermissions.mockReturnValue({
      permissions: [],
      isSuperAdmin: false,
      role: null,
      isLoading: true,
      has: jest.fn(() => false),
      hasAny: jest.fn(() => false),
      hasAll: jest.fn(() => false),
    });

    render(<AppRail />);

    expect(screen.queryByRole('link', { name: /team/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('renders the admin rail item from the server-provided super admin flag', () => {
    render(<AppRail isSuperAdmin />);

    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin');
  });
});
