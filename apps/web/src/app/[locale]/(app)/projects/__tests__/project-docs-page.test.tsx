/**
 * /projects/[projectId]/docs/page.tsx is a thin wrapper around <DocsShell>
 * that forwards `projectId`. These tests verify that the wrapper renders the
 * shell with the project scope (no hardcoded org fallback) and that common
 * shell states — populated + empty — work through the project route.
 *
 * The DocsShell itself has deeper coverage in components/docs/__tests__; this
 * suite exists to lock in the project-scoped wiring + projectId propagation.
 */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Spies for next/navigation.
const replaceSpy = jest.fn();
const redirectSpy = jest.fn((url: string) => {
  throw new Error(`redirect:${url}`);
});
const notFoundSpy = jest.fn(() => {
  throw new Error('not-found');
});
const mockAuth = jest.fn();
const mockResolveProjectAccess = jest.fn();
const mockGetUserFlags = jest.fn();
const mockGetProjectDocumentPermissions = jest.fn();
let currentSearchParamsString = '';

jest.mock('@/auth', () => ({
  auth: mockAuth,
}));

jest.mock('@/lib/auth/project-access', () => ({
  resolveProjectAccess: mockResolveProjectAccess,
}));

jest.mock('@/lib/docs/server', () => ({
  getUserFlags: mockGetUserFlags,
  getProjectDocumentPermissions: mockGetProjectDocumentPermissions,
}));

jest.mock('@/components/projects/project-access-denied', () => ({
  ProjectAccessDenied: () => <div data-testid="project-access-denied" />,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceSpy,
    push: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/projects/project-1/docs',
  useSearchParams: () => new URLSearchParams(currentSearchParamsString),
  redirect: redirectSpy,
  notFound: notFoundSpy,
}));

jest.mock('@/components/docs/document-editor', () => ({
  DocumentEditor: () => <div data-testid="doc-editor" />,
}));

jest.mock('@/components/chat/document-discussion-card', () => ({
  DocumentDiscussionCard: () => <div data-testid="doc-discussion-card" />,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({
    currentOrganizationId: 'org-1',
    currentTeamId: null,
    setCurrentOrganization: jest.fn(),
    setCurrentTeam: jest.fn(),
    clearContext: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-issues', () => ({
  useIssues: () => ({ data: [], isLoading: false }),
}));

// Capture the filters passed to the docs hooks so we can assert projectId
// propagation.
const spacesFilters = jest.fn();
const pagesFilters = jest.fn();

interface MockPage {
  id: string;
  spaceId: string;
  organizationId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  slug: string;
  icon: string | null;
  contentJson: Record<string, unknown>;
  contentText: string;
  excerpt: string | null;
  currentRevision: number;
  position: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  permissions?: Record<string, boolean>;
  space?: Record<string, unknown>;
}

function buildProjectPage(overrides: Partial<MockPage> = {}): MockPage {
  return {
    id: 'page-1',
    spaceId: 'space-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    parentId: null,
    title: 'Kickoff Notes',
    slug: 'kickoff-notes',
    icon: null,
    contentJson: { type: 'doc', content: [] },
    contentText: 'Welcome to the project docs.',
    excerpt: 'Welcome to the project docs.',
    currentRevision: 1,
    position: 0,
    isArchived: false,
    createdAt: new Date('2026-04-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-04-10T00:00:00Z').toISOString(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    permissions: { canBrowse: true, canCreate: true, canEdit: true, canDelete: false },
    space: {
      id: 'space-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      scope: 'project',
      name: 'Project Space',
      slug: 'project-space',
      description: null,
      isDefault: true,
      permissions: { canBrowse: true, canCreate: true, canEdit: true, canDelete: false },
    },
    ...overrides,
  };
}

let mockSpaces: Array<Record<string, unknown>> = [];
let mockPagesData: { space: Record<string, unknown> | null; pages: MockPage[] } | null = null;
let mockCurrentPage: MockPage | null = null;

jest.mock('@/lib/hooks/use-docs', () => ({
  useDocumentSpaces: (filters?: unknown) => {
    spacesFilters(filters);
    return { data: mockSpaces };
  },
  useDocumentPages: (filters?: unknown) => {
    pagesFilters(filters);
    return { data: mockPagesData, isLoading: false };
  },
  useDocumentPage: () => ({ data: mockCurrentPage, isLoading: false }),
  useDocumentTree: () => ({ data: null, isLoading: false }),
  useDocumentRevisions: () => ({ data: [] }),
  useDocumentSearch: () => ({ data: [] }),
  useDocumentAttachments: () => ({ data: [] }),
  useCreateDocumentPage: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateDocumentPage: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRestoreDocumentPage: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateDocumentShare: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUploadDocumentAttachment: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteDocumentAttachment: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

async function renderProjectDocsPage(projectId: string) {
  const { default: ProjectDocsPage } = await import('../[projectId]/docs/page');
  const element = await ProjectDocsPage({
    params: Promise.resolve({ projectId }),
  });
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{element as ReactNode}</QueryClientProvider>);
}

describe('Project docs page', () => {
  beforeEach(() => {
    replaceSpy.mockReset();
    spacesFilters.mockReset();
    pagesFilters.mockReset();
    currentSearchParamsString = '';
    mockSpaces = [];
    mockPagesData = null;
    mockCurrentPage = null;
    redirectSpy.mockClear();
    notFoundSpy.mockClear();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockResolveProjectAccess.mockResolvedValue({
      project: { id: 'project-1', organizationId: 'org-1' },
      canRead: true,
      canManage: true,
    });
    mockGetUserFlags.mockResolvedValue({ isSuperAdmin: false });
    mockGetProjectDocumentPermissions.mockResolvedValue({
      canBrowse: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
    });
  });

  it('renders the docs editor with project-scoped data', async () => {
    currentSearchParamsString = 'pageId=page-1&spaceId=space-1';
    const page = buildProjectPage();
    mockSpaces = [page.space!];
    mockPagesData = { space: page.space!, pages: [page] };
    mockCurrentPage = page;

    await renderProjectDocsPage('project-1');

    // The editor mounts when a project doc is selected.
    expect(await screen.findByTestId('doc-editor')).toBeInTheDocument();

    // Both docs hooks must be queried with the projectId so the API filters
    // server-side (no client-side filtering or org-wide leak).
    expect(spacesFilters).toHaveBeenCalled();
    const spaceCall = spacesFilters.mock.calls[0]?.[0] as { projectId?: string } | undefined;
    expect(spaceCall?.projectId).toBe('project-1');

    expect(pagesFilters).toHaveBeenCalled();
    const pagesCall = pagesFilters.mock.calls[0]?.[0] as { projectId?: string } | undefined;
    expect(pagesCall?.projectId).toBe('project-1');
  });

  it('renders the empty getting-started state when the project has no pages', async () => {
    currentSearchParamsString = '';
    mockSpaces = [];
    mockPagesData = { space: null, pages: [] };
    mockCurrentPage = null;

    await renderProjectDocsPage('project-1');

    // No editor, and the in-product empty state explains the project docs
    // space is ready but has no pages yet.
    expect(screen.queryByTestId('doc-editor')).not.toBeInTheDocument();
    expect(screen.getByText(/No pages yet in this space\./i)).toBeInTheDocument();

    // projectId still flows through even in the empty state so the "Create
    // first page" call lands in the project space.
    const pagesCall = pagesFilters.mock.calls[0]?.[0] as { projectId?: string } | undefined;
    expect(pagesCall?.projectId).toBe('project-1');
  });
});
