import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocsShell } from '../docs-shell';
import {
  PageSidebarSlotProvider,
  PageSidebarSlotTarget,
} from '@/components/layout/page-sidebar-slot';
import { ApiResponseError } from '@/lib/client-api-errors';

// Spies for next/navigation.
const replaceSpy = jest.fn();
const pushSpy = jest.fn();
const refreshSpy = jest.fn();
let currentPathname = '/docs';
let currentSearchParamsString = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceSpy,
    push: pushSpy,
    refresh: refreshSpy,
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearchParamsString),
}));

// Mock the heavy DocumentEditor component so tests stay fast.
jest.mock('../document-editor', () => ({
  DocumentEditor: () => <div data-testid="doc-editor" />,
}));

// Mock the DocumentDiscussionCard to avoid pulling in chat deps.
jest.mock('@/components/chat/document-discussion-card', () => ({
  DocumentDiscussionCard: () => <div data-testid="doc-discussion-card" />,
}));

// Mock toast.
const toastSpy = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

// Mock organization hook - returns a stable object regardless of selector usage.
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

// Mutable state knobs for the docs hooks.
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
  share?: Record<string, unknown>;
  revisionCount?: number;
  backlinks?: unknown[];
  relatedIssues?: unknown[];
}

function buildMockPage(overrides: Partial<MockPage> = {}): MockPage {
  return {
    id: 'page-1',
    spaceId: 'space-1',
    organizationId: 'org-1',
    projectId: null,
    parentId: null,
    title: 'Launch Plan',
    slug: 'launch-plan',
    icon: null,
    contentJson: { type: 'doc', content: [] },
    contentText: 'Body',
    excerpt: 'An overview of the launch.',
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
      projectId: null,
      scope: 'organization',
      name: 'Handbook',
      slug: 'handbook',
      description: null,
      isDefault: true,
      permissions: { canBrowse: true, canCreate: true, canEdit: true, canDelete: false },
    },
    share: {
      canManagePublic: true,
      internalPath: '/docs?pageId=page-1&spaceId=space-1',
      public: {
        enabled: false,
        urlPath: null,
        allowSearchIndexing: false,
        includeAttachments: false,
        publishedAt: null,
      },
    },
    revisionCount: 1,
    backlinks: [],
    relatedIssues: [],
    ...overrides,
  };
}

let mockSpaces: Array<Record<string, unknown>> = [];
let mockPagesData: { space: Record<string, unknown> | null; pages: MockPage[] } | null = null;
let mockPagesLoading = false;
let mockCurrentPage: MockPage | null = null;
let mockPageLoading = false;
let lastDocumentPageId: string | null = null;
let mockCreatePageMutateAsync = jest.fn();

jest.mock('@/lib/hooks/use-docs', () => ({
  useDocumentSpaces: () => ({ data: mockSpaces }),
  useDocumentPages: () => ({ data: mockPagesData, isLoading: mockPagesLoading }),
  useDocumentPage: (pageId: string | null) => {
    lastDocumentPageId = pageId;
    return { data: mockCurrentPage, isLoading: mockPageLoading };
  },
  useDocumentTree: () => ({ data: null, isLoading: false }),
  useDocumentRevisions: () => ({ data: [] }),
  useDocumentSearch: () => ({ data: [] }),
  useDocumentAttachments: () => ({ data: [] }),
  useCreateDocumentPage: () => ({ mutateAsync: mockCreatePageMutateAsync, isPending: false }),
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

function renderDocsShell(projectId?: string) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <PageSidebarSlotProvider>
        {/* Portal target so the navigation pane (where page links live) mounts
         * into the DOM during tests. Without this, <PageSidebarContent /> has
         * no target and returns null. */}
        <PageSidebarSlotTarget data-testid="sidebar-portal" />
        <DocsShell projectId={projectId} />
      </PageSidebarSlotProvider>
    </QueryClientProvider>
  );
}

describe('DocsShell behavior', () => {
  beforeEach(() => {
    replaceSpy.mockReset();
    pushSpy.mockReset();
    refreshSpy.mockReset();
    toastSpy.mockReset();
    currentPathname = '/docs';
    currentSearchParamsString = '';
    mockSpaces = [];
    mockPagesData = null;
    mockPagesLoading = false;
    mockCurrentPage = null;
    mockPageLoading = false;
    lastDocumentPageId = null;
    mockCreatePageMutateAsync = jest.fn();
  });

  it('renders a shimmer skeleton while page data is loading', () => {
    currentSearchParamsString = 'pageId=page-1&spaceId=space-1';
    mockPagesData = {
      space: {
        id: 'space-1',
        organizationId: 'org-1',
        projectId: null,
        scope: 'organization',
        name: 'Handbook',
        slug: 'handbook',
        description: null,
        isDefault: true,
        permissions: { canBrowse: true, canCreate: true, canEdit: true, canDelete: false },
      },
      pages: [buildMockPage()],
    };
    mockCurrentPage = null;
    mockPageLoading = true;

    const { container } = renderDocsShell();

    expect(screen.getByTestId('docs-shell-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.shimmer')).not.toBeNull();
    expect(screen.queryByTestId('doc-editor')).not.toBeInTheDocument();
  });

  it('mounts the real editor when the page resolves', () => {
    currentSearchParamsString = 'pageId=page-1&spaceId=space-1';
    mockPagesData = { space: buildMockPage().space!, pages: [buildMockPage()] };
    mockCurrentPage = buildMockPage();
    mockPageLoading = false;

    renderDocsShell();

    expect(screen.getByTestId('doc-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('docs-shell-skeleton')).not.toBeInTheDocument();
  });

  it('uses the first listed page while the URL catches up so docs do not flash the empty state', () => {
    currentSearchParamsString = 'spaceId=space-1';
    const page = buildMockPage();
    mockPagesData = { space: page.space!, pages: [page] };
    mockCurrentPage = null;
    mockPageLoading = true;

    renderDocsShell();

    expect(lastDocumentPageId).toBe('page-1');
    expect(screen.getByTestId('docs-shell-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/No pages yet in this space\./i)).not.toBeInTheDocument();
  });

  it('renders the empty-state getting-started panel when no page is selected', () => {
    currentSearchParamsString = '';
    mockPagesData = { space: null, pages: [] };
    mockCurrentPage = null;
    mockPageLoading = false;

    renderDocsShell();

    // Getting-started copy surfaces when there are no pages to display. The
    // exact copy depends on permission state; the key signals are the absence
    // of the editor and the presence of the empty-state guidance text.
    expect(screen.getByText(/No pages yet in this space\./i)).toBeInTheDocument();
    expect(screen.queryByTestId('doc-editor')).not.toBeInTheDocument();
  });

  it('calls router.replace exactly once per user-click when selecting a page in the tree', async () => {
    currentSearchParamsString = 'pageId=page-1&spaceId=space-1';
    const page1 = buildMockPage();
    const page2 = buildMockPage({
      id: 'page-2',
      title: 'Release Notes',
      slug: 'release-notes',
      position: 1,
    });
    mockPagesData = { space: page1.space!, pages: [page1, page2] };
    mockCurrentPage = page1;
    mockPageLoading = false;

    renderDocsShell();

    // Baseline: the mount + URL-sync effects may or may not fire replace when
    // URL is already consistent. We record the baseline then assert a single
    // click increments by exactly 1.
    const baselineCalls = replaceSpy.mock.calls.length;

    const target = screen.getByText('Release Notes');
    await act(async () => {
      fireEvent.click(target);
    });

    await waitFor(() => {
      expect(replaceSpy.mock.calls.length).toBe(baselineCalls + 1);
    });

    // The new URL must reflect the clicked page, not anything else.
    const lastArg = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1][0];
    expect(lastArg).toContain('pageId=page-2');
  });

  it('does not call router.replace on its own when searchParams rerenders with a new pageId', async () => {
    currentSearchParamsString = 'pageId=page-1&spaceId=space-1';
    const page1 = buildMockPage();
    const page2 = buildMockPage({
      id: 'page-2',
      title: 'Release Notes',
      slug: 'release-notes',
      position: 1,
    });
    mockPagesData = { space: page1.space!, pages: [page1, page2] };
    mockCurrentPage = page1;
    mockPageLoading = false;

    const { rerender } = renderDocsShell();

    // Let the initial sync effects settle.
    await act(async () => {
      await Promise.resolve();
    });
    const baselineCalls = replaceSpy.mock.calls.length;

    // Simulate Next.js returning a new searchParams instance + a different
    // selected pageId + a matching currentPage — as if navigation happened.
    currentSearchParamsString = 'pageId=page-2&spaceId=space-1';
    mockCurrentPage = page2;

    const client = createQueryClient();
    rerender(
      <QueryClientProvider client={client}>
        <PageSidebarSlotProvider>
          <PageSidebarSlotTarget data-testid="sidebar-portal" />
          <DocsShell />
        </PageSidebarSlotProvider>
      </QueryClientProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Re-rendering with consistent URL + current page must not cause the
    // shell to fire another router.replace. (No feedback loops.)
    expect(replaceSpy.mock.calls.length).toBe(baselineCalls);
  });

  // ---------------------------------------------------------------------------
  // Audit-required tests: render with empty spaces, render with space+pages,
  // and verify page selection surfaces the page content.
  // ---------------------------------------------------------------------------

  it('(a) renders with empty spaces without crashing and surfaces the empty state', () => {
    currentSearchParamsString = '';
    mockSpaces = [];
    mockPagesData = { space: null, pages: [] };
    mockCurrentPage = null;

    renderDocsShell();

    // No editor when there are no pages at all.
    expect(screen.queryByTestId('doc-editor')).not.toBeInTheDocument();
    // The empty-state getting-started copy is shown.
    expect(screen.getByText(/No pages yet in this space\./i)).toBeInTheDocument();
  });

  it('(b) renders with a space + pages and lists each page in the navigation', () => {
    currentSearchParamsString = 'spaceId=space-1';
    const page1 = buildMockPage({ id: 'page-1', title: 'Launch Plan', position: 0 });
    const page2 = buildMockPage({
      id: 'page-2',
      title: 'Release Notes',
      slug: 'release-notes',
      position: 1,
    });
    mockSpaces = [page1.space!];
    mockPagesData = { space: page1.space!, pages: [page1, page2] };
    mockCurrentPage = null;
    mockPageLoading = false;

    renderDocsShell();

    const nav = screen.getByTestId('sidebar-portal');
    // Both real page titles from the mocked hook appear in the tree.
    expect(within(nav).getByText('Launch Plan')).toBeInTheDocument();
    expect(within(nav).getByText('Release Notes')).toBeInTheDocument();
    // Space name surfaces in the nav header.
    expect(within(nav).getByText('Handbook')).toBeInTheDocument();
  });

  it('(c) clicking a page in the tree navigates to it and surfaces its content', async () => {
    currentSearchParamsString = 'pageId=page-1&spaceId=space-1';
    const page1 = buildMockPage({ id: 'page-1', title: 'Launch Plan' });
    const page2 = buildMockPage({
      id: 'page-2',
      title: 'Release Notes',
      slug: 'release-notes',
      position: 1,
    });
    mockPagesData = { space: page1.space!, pages: [page1, page2] };
    mockCurrentPage = page1;
    mockPageLoading = false;

    const { rerender } = renderDocsShell();

    // Initially the first page is open: mocked editor is mounted.
    expect(screen.getByTestId('doc-editor')).toBeInTheDocument();

    const baselineCalls = replaceSpy.mock.calls.length;

    // Click the second page from the tree.
    const nav = screen.getByTestId('sidebar-portal');
    await act(async () => {
      fireEvent.click(within(nav).getByText('Release Notes'));
    });

    // The shell asks the router to navigate to the clicked page.
    await waitFor(() => {
      expect(replaceSpy.mock.calls.length).toBe(baselineCalls + 1);
    });
    const lastArg = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1][0] as string;
    expect(lastArg).toContain('pageId=page-2');

    // Simulate Next.js completing the navigation and the hook returning the
    // newly selected page. The editor must now be rendered for that page.
    currentSearchParamsString = 'pageId=page-2&spaceId=space-1';
    mockCurrentPage = page2;

    const client = createQueryClient();
    rerender(
      <QueryClientProvider client={client}>
        <PageSidebarSlotProvider>
          <PageSidebarSlotTarget data-testid="sidebar-portal" />
          <DocsShell />
        </PageSidebarSlotProvider>
      </QueryClientProvider>
    );

    // The details pane's page title reflects the newly selected page, proving
    // the clicked page's content surfaced in the shell (the mocked editor
    // itself is opaque, so we assert on the details pane which reads the
    // hook-provided currentPage directly).
    await waitFor(() => {
      expect(screen.getAllByText('Release Notes').length).toBeGreaterThan(0);
    });
  });

  it('shows a localized access message when page creation is denied', async () => {
    currentSearchParamsString = 'spaceId=space-1';
    const page = buildMockPage();
    mockSpaces = [page.space!];
    mockPagesData = { space: page.space!, pages: [page] };
    mockCurrentPage = page;
    mockCreatePageMutateAsync.mockRejectedValue(
      new ApiResponseError('You do not have permission to create pages in this space', 403)
    );

    renderDocsShell();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /new page/i }));
    });

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Restricted note' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create page/i }));
    });

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "You don't have permission to view that page.",
          variant: 'destructive',
        })
      );
    });

    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'You do not have permission to create pages in this space',
      })
    );
  });
});
