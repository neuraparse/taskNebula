import { render, screen } from '@testing-library/react';
import ProjectsPage from '../page';
import { auth } from '@/auth';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('@/lib/auth/workspace-access', () => ({
  userHasWorkspaceAccess: jest.fn(),
}));

jest.mock('@/components/layout/workspace-required-notice', () => ({
  WorkspaceRequiredNotice: () => <div data-testid="workspace-required-notice" />,
}));

jest.mock('../projects-client', () => ({
  ProjectsClient: () => <div data-testid="projects-client" />,
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockUserHasWorkspaceAccess = userHasWorkspaceAccess as jest.MockedFunction<
  typeof userHasWorkspaceAccess
>;

async function renderPage() {
  render(await ProjectsPage());
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<ReturnType<typeof auth>>);
  });

  it('redirects anonymous users to sign in', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(ProjectsPage()).rejects.toThrow('NEXT_REDIRECT:/auth/signin');
  });

  it('renders the workspace required notice when the user has no workspace access', async () => {
    mockUserHasWorkspaceAccess.mockResolvedValue(false);

    await renderPage();

    expect(screen.getByTestId('workspace-required-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('projects-client')).not.toBeInTheDocument();
  });

  it('renders projects when the user has workspace access', async () => {
    mockUserHasWorkspaceAccess.mockResolvedValue(true);

    await renderPage();

    expect(screen.getByTestId('projects-client')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-required-notice')).not.toBeInTheDocument();
  });
});
