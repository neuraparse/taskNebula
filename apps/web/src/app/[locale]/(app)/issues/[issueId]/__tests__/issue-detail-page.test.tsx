import { render, screen } from '@testing-library/react';
import IssueDetailPage from '../page';
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

jest.mock('@/components/issues/issue-detail-view', () => ({
  IssueDetailView: ({ issueId }: { issueId: string }) => (
    <div data-testid="issue-detail-view">{issueId}</div>
  ),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockUserHasWorkspaceAccess = userHasWorkspaceAccess as jest.MockedFunction<
  typeof userHasWorkspaceAccess
>;

function pageParams(issueId = 'ISSUE-1') {
  return { params: Promise.resolve({ issueId }) };
}

async function renderPage(issueId = 'ISSUE-1') {
  render(await IssueDetailPage(pageParams(issueId)));
}

describe('IssueDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<ReturnType<typeof auth>>);
  });

  it('redirects anonymous users to sign in with the issue callback', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(IssueDetailPage(pageParams('TN-42'))).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?callbackUrl=/issues/TN-42'
    );
  });

  it('renders the workspace required notice when the user has no workspace access', async () => {
    mockUserHasWorkspaceAccess.mockResolvedValue(false);

    await renderPage();

    expect(screen.getByTestId('workspace-required-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('issue-detail-view')).not.toBeInTheDocument();
  });

  it('renders the issue detail view when the user has workspace access', async () => {
    mockUserHasWorkspaceAccess.mockResolvedValue(true);

    await renderPage('TN-99');

    expect(screen.getByTestId('issue-detail-view')).toHaveTextContent('TN-99');
    expect(screen.queryByTestId('workspace-required-notice')).not.toBeInTheDocument();
  });
});
