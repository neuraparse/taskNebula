import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { AppRail } from '../app-rail';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useInbox } from '@/lib/hooks/use-inbox';

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

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockUseInbox = useInbox as jest.MockedFunction<typeof useInbox>;

describe('AppRail', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    mockUsePathname.mockImplementation(() => mockPathname);
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Ada Lovelace', email: 'ada@example.com', image: null } },
      status: 'authenticated',
    } as unknown as ReturnType<typeof useSession>);
    mockUseInbox.mockReturnValue({
      data: { items: [] },
    } as unknown as ReturnType<typeof useInbox>);
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
});
