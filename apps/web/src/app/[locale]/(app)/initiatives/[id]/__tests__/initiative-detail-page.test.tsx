import { render, screen } from '@testing-library/react';
import InitiativeDetailPage from '../page';
import { auth } from '@/auth';
import { resolveInitiativeAccess } from '@/lib/initiatives/access';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/initiatives/access', () => ({
  resolveInitiativeAccess: jest.fn(),
}));

jest.mock('@/components/layout/workspace-required-notice', () => ({
  WorkspaceRequiredNotice: () => <div data-testid="workspace-required-notice" />,
}));

jest.mock('../initiative-detail-client', () => ({
  InitiativeDetailClient: ({ initiativeId }: { initiativeId: string }) => (
    <div data-testid="initiative-detail-client">{initiativeId}</div>
  ),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockResolveInitiativeAccess = resolveInitiativeAccess as jest.MockedFunction<
  typeof resolveInitiativeAccess
>;

async function renderPage(id = 'init-1') {
  render(await InitiativeDetailPage({ params: Promise.resolve({ id }) }));
}

describe('InitiativeDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<ReturnType<typeof auth>>);
    mockResolveInitiativeAccess.mockResolvedValue({
      initiative: { id: 'init-1' } as Awaited<
        ReturnType<typeof resolveInitiativeAccess>
      >['initiative'],
      canRead: true,
    });
  });

  it('redirects anonymous users to sign in', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      InitiativeDetailPage({ params: Promise.resolve({ id: 'init-1' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
  });

  it('renders a workspace access notice when the initiative is not readable', async () => {
    mockResolveInitiativeAccess.mockResolvedValue({
      initiative: { id: 'init-1' } as Awaited<
        ReturnType<typeof resolveInitiativeAccess>
      >['initiative'],
      canRead: false,
    });

    await renderPage();

    expect(screen.getByTestId('workspace-required-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('initiative-detail-client')).not.toBeInTheDocument();
  });

  it('renders the detail client only after initiative access is confirmed', async () => {
    await renderPage('init-2');

    expect(mockResolveInitiativeAccess).toHaveBeenCalledWith('user-1', 'init-2');
    expect(screen.getByTestId('initiative-detail-client')).toHaveTextContent('init-2');
    expect(screen.queryByTestId('workspace-required-notice')).not.toBeInTheDocument();
  });

  it('returns not found for unknown initiatives', async () => {
    mockResolveInitiativeAccess.mockResolvedValue({
      initiative: null,
      canRead: false,
    });

    await expect(
      InitiativeDetailPage({ params: Promise.resolve({ id: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
