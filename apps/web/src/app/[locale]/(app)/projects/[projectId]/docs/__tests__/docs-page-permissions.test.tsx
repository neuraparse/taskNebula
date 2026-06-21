import { render, screen } from '@testing-library/react';
import ProjectDocsPage from '../page';
import { auth } from '@/auth';
import { resolveProjectAccess } from '@/lib/auth/project-access';
import { getProjectDocumentPermissions, getUserFlags } from '@/lib/docs/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/project-access', () => ({
  resolveProjectAccess: jest.fn(),
}));

jest.mock('@/lib/docs/server', () => ({
  getProjectDocumentPermissions: jest.fn(),
  getUserFlags: jest.fn(),
}));

jest.mock('@/components/docs/docs-shell', () => ({
  DocsShell: ({ projectId }: { projectId: string }) => (
    <div data-testid="docs-shell">{projectId}</div>
  ),
}));

jest.mock('@/components/projects/project-access-denied', () => ({
  ProjectAccessDenied: () => <div data-testid="project-access-denied" />,
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockResolveProjectAccess = resolveProjectAccess as jest.MockedFunction<
  typeof resolveProjectAccess
>;
const mockGetUserFlags = getUserFlags as jest.MockedFunction<typeof getUserFlags>;
const mockGetProjectDocumentPermissions = getProjectDocumentPermissions as jest.MockedFunction<
  typeof getProjectDocumentPermissions
>;

describe('ProjectDocsPage permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<ReturnType<typeof auth>>);
    mockResolveProjectAccess.mockResolvedValue({
      project: { id: 'project-1', key: 'PRJ', name: 'Project', organizationId: 'org-1' } as never,
      canRead: true,
      canManage: false,
    });
    mockGetUserFlags.mockResolvedValue({ isSuperAdmin: false });
  });

  it('renders the project docs shell when the user can browse docs', async () => {
    mockGetProjectDocumentPermissions.mockResolvedValue({
      canBrowse: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });

    render(await ProjectDocsPage({ params: Promise.resolve({ projectId: 'PRJ' }) }));

    expect(screen.getByTestId('docs-shell')).toHaveTextContent('PRJ');
    expect(screen.queryByTestId('project-access-denied')).not.toBeInTheDocument();
  });

  it('renders access denied instead of the docs shell when docs browse is denied', async () => {
    mockGetProjectDocumentPermissions.mockResolvedValue({
      canBrowse: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });

    render(await ProjectDocsPage({ params: Promise.resolve({ projectId: 'PRJ' }) }));

    expect(screen.getByTestId('project-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('docs-shell')).not.toBeInTheDocument();
  });
});
