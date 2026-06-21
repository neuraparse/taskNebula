import { render, screen } from '@testing-library/react';
import DashboardPage from '../page';
import { currentUserHasWorkspaceAccess } from '@/lib/auth/workspace-access';

jest.mock('@/lib/auth/workspace-access', () => ({
  currentUserHasWorkspaceAccess: jest.fn(),
}));

jest.mock('@/components/layout/workspace-required-notice', () => ({
  WorkspaceRequiredNotice: () => <div data-testid="workspace-required-notice" />,
}));

jest.mock('../dashboard-client', () => ({
  DashboardClient: () => <div data-testid="dashboard-client" />,
}));

const mockCurrentUserHasWorkspaceAccess = currentUserHasWorkspaceAccess as jest.MockedFunction<
  typeof currentUserHasWorkspaceAccess
>;

async function renderPage() {
  render(await DashboardPage());
}

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the workspace required notice when the user has no workspace access', async () => {
    mockCurrentUserHasWorkspaceAccess.mockResolvedValue(false);

    await renderPage();

    expect(screen.getByTestId('workspace-required-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-client')).not.toBeInTheDocument();
  });

  it('renders the dashboard when the user has workspace access', async () => {
    mockCurrentUserHasWorkspaceAccess.mockResolvedValue(true);

    await renderPage();

    expect(screen.getByTestId('dashboard-client')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-required-notice')).not.toBeInTheDocument();
  });
});
