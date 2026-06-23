'use client';
// QUAL-21 TS-strict-migration: file untouched intentionally; surfaces 8 errors
// under `exactOptionalPropertyTypes`. See docs/TS_STRICT_MIGRATION.md.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useIssues } from '@/lib/hooks/use-issues';
import {
  useCreateDocumentPage,
  useDeleteDocumentAttachment,
  useDocumentAttachments,
  useDocumentPage,
  useDocumentPages,
  useDocumentRevisions,
  useDocumentSearch,
  useDocumentSpaces,
  useRestoreDocumentPage,
  useUpdateDocumentShare,
  useUpdateDocumentPage,
  useUploadDocumentAttachment,
  type DocumentPage,
  type DocumentPageSummary,
  type DocumentShareUpdateInput,
  type DocumentTreeNode,
} from '@/lib/hooks/use-docs';
import { DocsGettingStarted } from './docs-getting-started';
import { extractDocumentHeadings } from '@/lib/docs/content';
import { buildDocumentTree } from '@/lib/docs/tree';
import { formatFileSize } from '@/lib/hooks/use-attachments';
import { useToast } from '@/hooks/use-toast';
import {
  isApiConflictError,
  isApiPermissionError,
  throwApiResponseError,
} from '@/lib/client-api-errors';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PageSidebarContent } from '@/components/layout/page-sidebar-slot';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DOCUMENT_ICON_OPTIONS, DocumentIcon } from './document-icon';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  Globe2,
  RefreshCcw,
  Search,
  Share2,
  Trash2,
  Unlink2,
} from 'lucide-react';

interface DocsShellProps {
  projectId?: string;
}

type DetailsTab = 'overview' | 'history' | 'connections';

const DocumentEditor = dynamic(
  () => import('./document-editor').then((mod) => mod.DocumentEditor),
  {
    loading: () => <DocsShellSkeleton />,
  }
);

const DocumentDiscussionCard = dynamic(
  () =>
    import('@/components/chat/document-discussion-card').then((mod) => mod.DocumentDiscussionCard),
  {
    loading: () => null,
  }
);

export function DocsShell({ projectId }: DocsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();
  const t = useTranslations('collab');
  const tHome = useTranslations('pagesHome');

  const [pageSearch, setPageSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageIcon, setNewPageIcon] = useState<string | null>(null);
  const [newPageParentId, setNewPageParentId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [issueToAttach, setIssueToAttach] = useState<string>('');
  const [isPagesSheetOpen, setIsPagesSheetOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('overview');

  const requestedPageId = searchParams.get('pageId');
  const selectedSpaceId = searchParams.get('spaceId');

  // Ref-capture router/pathname/searchParams to avoid effects re-firing when
  // Next.js returns a new searchParams instance after each router.replace().
  // A single boolean guard prevents the three URL-sync effects from
  // ping-ponging during a mutation burst (same fix as chat-shell).
  const routerRef = useRef(router);
  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);
  const isSyncingUrlRef = useRef(false);

  useEffect(() => {
    routerRef.current = router;
    pathnameRef.current = pathname;
    searchParamsRef.current = searchParams;
  }, [router, pathname, searchParams]);

  const { data: spaces } = useDocumentSpaces({
    organizationId: currentOrganizationId,
    projectId: projectId || null,
  });

  const { data: pagesData, isLoading: pagesLoading } = useDocumentPages({
    spaceId: selectedSpaceId,
    organizationId: currentOrganizationId,
    projectId: projectId || null,
  });

  const defaultPageId = !requestedPageId ? (pagesData?.pages?.[0]?.id ?? null) : null;
  const selectedPageId = requestedPageId ?? defaultPageId;

  const { data: currentPage, isLoading: pageLoading } = useDocumentPage(selectedPageId);
  const shouldLoadHistory = detailsTab === 'history';
  const shouldLoadConnections = detailsTab === 'connections';
  const { data: revisions = [] } = useDocumentRevisions(selectedPageId, {
    enabled: shouldLoadHistory,
  });
  const { data: attachments = [] } = useDocumentAttachments(selectedPageId, {
    enabled: shouldLoadConnections,
  });
  const createPage = useCreateDocumentPage();
  const updatePage = useUpdateDocumentPage();
  const restorePage = useRestoreDocumentPage();
  const updateShare = useUpdateDocumentShare(selectedPageId);
  const uploadAttachment = useUploadDocumentAttachment(selectedPageId || '');
  const deleteAttachment = useDeleteDocumentAttachment(selectedPageId || '');

  const activeSpace = currentPage?.space || pagesData?.space || spaces?.[0] || null;
  const allPages: DocumentPageSummary[] = pagesData?.pages || [];
  const createTargetSpace =
    activeSpace || spaces?.find((space) => space.permissions?.canCreate) || spaces?.[0] || null;
  const pagePermissions =
    currentPage?.permissions || activeSpace?.permissions || createTargetSpace?.permissions || null;
  const canEditCurrentPage = !!pagePermissions?.canEdit;
  const { data: searchableIssues } = useIssues(
    { projectId: currentPage?.projectId || undefined },
    { enabled: shouldLoadConnections && !!currentPage?.projectId && canEditCurrentPage }
  );
  const canCreateChildPages = !!pagePermissions?.canCreate;
  const canCreateInContext =
    createTargetSpace?.permissions?.canCreate ??
    spaces?.some((space) => space.permissions?.canCreate) ??
    Boolean(projectId || currentOrganizationId);
  const scopeLabel = projectId ? t('shell.scope.project') : t('shell.scope.organization');

  const filteredPages = pageSearch.trim()
    ? allPages.filter((page) => {
        const query = pageSearch.toLowerCase();
        return (
          page.title.toLowerCase().includes(query) ||
          page.slug.toLowerCase().includes(query) ||
          (page.excerpt || '').toLowerCase().includes(query)
        );
      })
    : allPages;

  const { data: searchResults = [] } = useDocumentSearch({
    query: pageSearch,
    organizationId: currentOrganizationId,
    projectId: projectId || null,
    enabled: pageSearch.trim().length > 1,
  });

  const tree = buildDocumentTree(filteredPages);
  const showSearchResults = pageSearch.trim().length > 1;
  const selectedParentPage = newPageParentId
    ? allPages.find((page) => page.id === newPageParentId) || null
    : null;
  const currentPageHeadings = currentPage ? extractDocumentHeadings(currentPage.contentJson) : [];
  const currentPageWordCount = currentPage?.contentText
    ? currentPage.contentText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const currentChildPages = currentPage
    ? [...allPages].filter((page) => page.parentId === currentPage.id).sort(sortDocumentPages)
    : [];
  const currentSharePath =
    currentPage?.share?.internalPath ||
    (currentPage ? `${pathname}?pageId=${currentPage.id}&spaceId=${currentPage.spaceId}` : null);
  const publicSharePath = currentPage?.share?.public?.enabled
    ? currentPage.share.public.urlPath
    : null;

  useEffect(() => {
    if (isSyncingUrlRef.current) {
      return;
    }
    if (!selectedSpaceId && pagesData?.space?.id) {
      isSyncingUrlRef.current = true;
      updateQueryParams({ spaceId: pagesData.space.id, pageId: selectedPageId });
    }
  }, [pagesData?.space?.id, selectedSpaceId, selectedPageId]);

  useEffect(() => {
    if (isSyncingUrlRef.current) {
      return;
    }
    const firstPage = pagesData?.pages?.[0];
    if (!requestedPageId && firstPage) {
      isSyncingUrlRef.current = true;
      updateQueryParams({
        pageId: firstPage.id,
        spaceId: pagesData.space?.id || selectedSpaceId || undefined,
      });
    }
  }, [pagesData?.pages, pagesData?.space?.id, requestedPageId, selectedSpaceId]);

  useEffect(() => {
    if (isSyncingUrlRef.current) {
      return;
    }
    if (currentPage?.space?.id && currentPage.space.id !== selectedSpaceId) {
      isSyncingUrlRef.current = true;
      updateQueryParams({ pageId: currentPage.id, spaceId: currentPage.space.id });
    }
  }, [currentPage?.id, currentPage?.space?.id, selectedSpaceId]);

  // Release the guard once a new searchParams snapshot has propagated.
  useEffect(() => {
    isSyncingUrlRef.current = false;
  }, [searchParams]);

  function updateQueryParams(next: { pageId?: string | null; spaceId?: string | null }) {
    const params = new URLSearchParams(searchParamsRef.current.toString());

    if (next.pageId) params.set('pageId', next.pageId);
    if (next.spaceId) params.set('spaceId', next.spaceId);
    if (next.pageId === null) params.delete('pageId');
    if (next.spaceId === null) params.delete('spaceId');

    routerRef.current.replace(`${pathnameRef.current}?${params.toString()}`);
    setIsPagesSheetOpen(false);
    setIsDetailsSheetOpen(false);
  }

  function formatDocsError(error: unknown, fallback: string) {
    if (isApiPermissionError(error)) {
      return tHome('toast_access_denied_description');
    }
    return error instanceof Error ? error.message : fallback;
  }

  async function handleCreatePage() {
    if (!newPageTitle.trim()) {
      return;
    }

    if (!canCreateInContext) {
      toast({
        title: t('shell.toast.createDisabledTitle'),
        description: t('shell.toast.createDisabledBody'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const page = await createPage.mutateAsync({
        title: newPageTitle.trim(),
        icon: newPageIcon,
        spaceId: createTargetSpace?.id,
        projectId: projectId || undefined,
        organizationId: !projectId ? currentOrganizationId || undefined : undefined,
        parentId: newPageParentId,
      });

      setIsCreateDialogOpen(false);
      setIsPagesSheetOpen(false);
      setNewPageTitle('');
      setNewPageIcon(null);
      setNewPageParentId(null);
      updateQueryParams({ pageId: page.id, spaceId: page.spaceId });
      toast({
        title: t('shell.toast.pageCreated'),
        description: t('shell.toast.pageCreatedBody', { title: page.title }),
      });
    } catch (error) {
      toast({
        title: t('shell.toast.pageCreateFailed'),
        description: formatDocsError(error, t('common.somethingWrong')),
        variant: 'destructive',
      });
    }
  }

  function openCreateDialog(parentId: string | null = null) {
    if (!canCreateInContext) {
      toast({
        title: t('shell.toast.createDisabledTitle'),
        description: t('shell.toast.createDisabledBody'),
        variant: 'destructive',
      });
      return;
    }

    if (!selectedSpaceId && createTargetSpace?.id) {
      updateQueryParams({ spaceId: createTargetSpace.id, pageId: selectedPageId });
    }

    setIsPagesSheetOpen(false);
    setNewPageTitle('');
    setNewPageIcon(null);
    setNewPageParentId(parentId);
    setIsCreateDialogOpen(true);
  }

  function resetCreateDialog() {
    setIsCreateDialogOpen(false);
    setNewPageTitle('');
    setNewPageIcon(null);
    setNewPageParentId(null);
  }

  async function handleSavePage(data: {
    title: string;
    icon: string | null;
    contentJson: DocumentPage['contentJson'];
    expectedRevision: number;
  }): Promise<DocumentPage> {
    if (!selectedPageId) {
      throw new Error(t('shell.error.openPageBeforeSaving'));
    }

    setSaveError(null);
    try {
      const page = await updatePage.mutateAsync({
        pageId: selectedPageId,
        data,
      });
      return page;
    } catch (error) {
      const message = formatDocsError(error, t('shell.error.saveFailed'));
      setSaveError(message);

      if (isApiConflictError(error)) {
        queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
        queryClient.invalidateQueries({ queryKey: ['document-revisions', selectedPageId] });
      }

      toast({
        title: t('shell.toast.saveFailed'),
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  }

  async function handleRestoreRevision(revisionId: string) {
    if (!selectedPageId) {
      return;
    }

    try {
      await restorePage.mutateAsync({ pageId: selectedPageId, revisionId });
      setSaveError(null);
      toast({
        title: t('shell.toast.revisionRestored'),
        description: t('shell.toast.revisionRestoredBody'),
      });
    } catch (error) {
      toast({
        title: t('shell.toast.restoreFailed'),
        description: formatDocsError(error, t('shell.error.restoreFailed')),
        variant: 'destructive',
      });
    }
  }

  async function handleAttachIssue() {
    if (!selectedPageId || !issueToAttach) {
      return;
    }

    try {
      const response = await fetch(`/api/issues/${issueToAttach}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedPageId }),
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('shell.error.linkIssueFailed'));
      }

      setIssueToAttach('');
      queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
      queryClient.invalidateQueries({ queryKey: ['issue-docs', issueToAttach] });
      toast({
        title: t('shell.toast.taskLinked'),
        description: t('shell.toast.taskLinkedBody'),
      });
    } catch (error) {
      toast({
        title: t('shell.toast.taskLinkFailed'),
        description: formatDocsError(error, t('common.somethingWrong')),
        variant: 'destructive',
      });
    }
  }

  async function handleDetachIssue(issueId: string) {
    if (!selectedPageId) {
      return;
    }

    try {
      const response = await fetch(`/api/issues/${issueId}/docs?pageId=${selectedPageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('shell.error.unlinkTaskFailed'));
      }

      queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
      queryClient.invalidateQueries({ queryKey: ['issue-docs', issueId] });
      toast({
        title: t('shell.toast.taskUnlinked'),
        description: t('shell.toast.taskUnlinkedBody'),
      });
    } catch (error) {
      toast({
        title: t('shell.toast.taskUnlinkFailed'),
        description: formatDocsError(error, t('common.somethingWrong')),
        variant: 'destructive',
      });
    }
  }

  async function handleUploadImage(file: File) {
    if (!selectedPageId) {
      throw new Error(t('shell.error.openPageBeforeUpload'));
    }

    const result = await uploadAttachment.mutateAsync(file);
    queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
    return result.attachment.filePath;
  }

  async function copyCurrentPageLink() {
    if (!currentSharePath) {
      return;
    }

    const value =
      typeof window !== 'undefined'
        ? `${window.location.origin}${currentSharePath}`
        : currentSharePath;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined') {
        window.prompt(t('shell.share.promptCopyPageLink'), value);
      }

      toast({
        title: t('shell.toast.pageLinkCopied'),
        description: t('shell.toast.pageLinkCopiedBody'),
      });
    } catch {
      toast({
        title: t('shell.toast.pageLinkCopyFailed'),
        description: t('shell.toast.clipboardBlocked'),
        variant: 'destructive',
      });
    }
  }

  async function copyPublicPageLink() {
    if (!publicSharePath) {
      return;
    }

    const value =
      typeof window !== 'undefined'
        ? `${window.location.origin}${publicSharePath}`
        : publicSharePath;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined') {
        window.prompt(t('shell.share.promptCopyPublicLink'), value);
      }

      toast({
        title: t('shell.toast.publicLinkCopied'),
        description: t('shell.toast.publicLinkCopiedBody'),
      });
    } catch {
      toast({
        title: t('shell.toast.publicLinkCopyFailed'),
        description: t('shell.toast.clipboardBlocked'),
        variant: 'destructive',
      });
    }
  }

  async function handleUpdateShare(data: DocumentShareUpdateInput): Promise<DocumentPage> {
    if (!selectedPageId) {
      throw new Error(t('shell.error.openPageBeforeSharing'));
    }

    return updateShare.mutateAsync(data);
  }

  async function updateShareWithToast(data: DocumentShareUpdateInput, successMessage: string) {
    try {
      await handleUpdateShare(data);
      toast({
        title: t('shell.toast.sharingUpdated'),
        description: successMessage,
      });
    } catch (error) {
      toast({
        title: t('shell.toast.sharingUpdateFailed'),
        description: formatDocsError(error, t('common.somethingWrong')),
        variant: 'destructive',
      });
    }
  }

  const isLoading = pagesLoading || (selectedPageId ? pageLoading : false);

  // Group top-level tree nodes into "Collections" (have children) and
  // "Workspace" (leaf pages). Search results bypass this grouping.
  const collectionsNodes = tree.filter((node) => node.children.length > 0);
  const workspaceNodes = tree.filter((node) => node.children.length === 0);

  const navigationPane = (
    <>
      <div className="border-border border-b px-3 py-3">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <FolderOpen className="text-muted-foreground h-3.5 w-3.5" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-tight">
                {activeSpace?.name || t('shell.docsTitle')}
              </div>
            </div>
            <span className="text-muted-foreground text-[11px]">{allPages.length}</span>
          </div>

          {spaces && spaces.length > 1 && (
            <Select
              value={activeSpace?.id}
              onValueChange={(spaceId) => {
                updateQueryParams({ spaceId, pageId: null });
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder={t('shell.selectSpace')} />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => openCreateDialog(null)}
            disabled={!canCreateInContext}
            className="bg-accent/30 text-foreground hover:bg-accent/60 flex h-9 w-full items-center justify-center gap-2 border-dashed text-sm font-medium transition-colors"
            aria-label={t('shell.createNewPage')}
          >
            <FilePlus2 className="h-4 w-4" />
            <span>{t('shell.newPage')}</span>
          </Button>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={pageSearch}
                onChange={(event) => setPageSearch(event.target.value)}
                placeholder={t('shell.searchPages')}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {showSearchResults ? (
          <div className="stagger space-y-0.5">
            {searchResults.length > 0 ? (
              searchResults.map((result) => (
                <button
                  key={result.id}
                  className="row-interactive flex w-full items-start gap-2.5 px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    setPageSearch('');
                    updateQueryParams({ pageId: result.id, spaceId: result.spaceId });
                  }}
                  type="button"
                >
                  <DocumentIcon icon={result.icon} className="h-6 w-6 rounded-md text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{result.title}</div>
                    <div className="text-muted-foreground mt-0.5 truncate text-[11px]">
                      {result.spaceName}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                {t('shell.noMatches')}
              </div>
            )}
          </div>
        ) : tree.length > 0 ? (
          <div className="stagger space-y-3">
            <SidebarSection
              title={t('shell.collections')}
              defaultOpen
              count={collectionsNodes.length}
            >
              {collectionsNodes.length > 0 ? (
                <div className="space-y-0.5">
                  {collectionsNodes.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      activePageId={selectedPageId}
                      onSelect={(pageId) =>
                        updateQueryParams({ pageId, spaceId: activeSpace?.id || null })
                      }
                      isCollectionRoot
                    />
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground px-2 py-2 text-[11px]">
                  {t('shell.noCollections')}
                </div>
              )}
            </SidebarSection>

            <SidebarSection title={t('shell.workspace')} defaultOpen count={workspaceNodes.length}>
              {workspaceNodes.length > 0 ? (
                <div className="space-y-0.5">
                  {workspaceNodes.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      activePageId={selectedPageId}
                      onSelect={(pageId) =>
                        updateQueryParams({ pageId, spaceId: activeSpace?.id || null })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground px-2 py-2 text-[11px]">
                  {t('shell.noStandalonePages')}
                </div>
              )}
            </SidebarSection>
          </div>
        ) : pagesLoading ? (
          <DocsTreeSkeleton />
        ) : (
          <div className="px-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">{t('shell.noPagesYet')}</p>
            {canCreateInContext ? (
              <p className="text-muted-foreground/70 mt-1 text-[11px]">{t('shell.noPagesHint')}</p>
            ) : null}
          </div>
        )}
      </div>
    </>
  );

  const detailsPane = currentPage ? (
    <div className="bg-background min-h-full">
      <div className="border-border border-b px-5 pb-4 pr-14 pt-5">
        <span className="kicker">{t('shell.details.kicker')}</span>
        <div className="mt-3 flex items-start gap-3">
          <DocumentIcon icon={currentPage.icon} className="h-9 w-9 rounded-md text-sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-tight">{currentPage.title}</div>
            <div className="text-muted-foreground mt-1 truncate text-xs">
              {currentPage.projectId
                ? t('shell.details.projectDoc')
                : t('shell.details.workspaceNote')}
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={detailsTab}
        onValueChange={(value) => setDetailsTab(value as DetailsTab)}
        className="flex min-h-full flex-col gap-4 p-4"
      >
        <TabsList className="grid h-9 grid-cols-3">
          <TabsTrigger value="overview" className="text-sm">
            {t('shell.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-sm">
            {t('shell.tabs.history')}
          </TabsTrigger>
          <TabsTrigger value="connections" className="text-sm">
            {t('shell.tabs.links')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-3">
          <DetailSection title={t('shell.section.overview')}>
            <DetailRow label={t('shell.row.page')}>
              <div className="flex items-start gap-3">
                <DocumentIcon icon={currentPage.icon} className="h-8 w-8 rounded-sm text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{currentPage.title}</div>
                  {currentPage.excerpt && (
                    <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-5">
                      {currentPage.excerpt}
                    </div>
                  )}
                </div>
              </div>
            </DetailRow>
            <DetailRow
              label={t('shell.row.type')}
              value={
                currentPage.projectId ? t('shell.value.projectDoc') : t('shell.value.wikiPage')
              }
            />
            <DetailRow
              label={t('shell.row.visibility')}
              value={
                currentPage.share?.public?.enabled
                  ? t('shell.value.workspacePublic')
                  : t('shell.value.workspaceOnly')
              }
            />
            <DetailRow
              label={t('shell.row.updated')}
              value={new Date(currentPage.updatedAt).toLocaleDateString()}
            />
            <DetailRow label={t('shell.row.words')} value={currentPageWordCount} />
            <DetailRow
              label={t('shell.row.revisions')}
              value={currentPage.revisionCount || revisions.length}
            />
            <DetailRow label={t('shell.row.subNotes')} value={currentChildPages.length} />
          </DetailSection>

          <DetailSection title={t('shell.section.sharing')}>
            <DetailRow label={t('shell.row.workspaceLink')}>
              <div className="space-y-2">
                <div className="text-muted-foreground truncate font-mono text-[11px]">
                  {currentSharePath || '/docs'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyCurrentPageLink()}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {t('shell.copy')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (currentSharePath && typeof window !== 'undefined') {
                        window.open(currentSharePath, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t('shell.open')}
                  </Button>
                </div>
              </div>
            </DetailRow>
            <DetailRow label={t('shell.row.publicAccess')}>
              <div className="flex items-center gap-3">
                <Switch
                  checked={currentPage.share?.public?.enabled}
                  disabled={!currentPage.share?.canManagePublic || updateShare.isPending}
                  onCheckedChange={(checked) =>
                    void updateShareWithToast(
                      { enablePublic: checked },
                      checked
                        ? t('shell.share.msg.publicEnabled')
                        : t('shell.share.msg.publicDisabled')
                    )
                  }
                />
                <span className="text-muted-foreground text-xs">
                  {currentPage.share?.public?.enabled ? t('shell.enabled') : t('shell.disabled')}
                </span>
              </div>
            </DetailRow>
            <Accordion type="single" collapsible className="rounded-lg border">
              <AccordionItem value="public-settings" className="border-b-0">
                <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                  {t('shell.advancedPublicSettings')}
                </AccordionTrigger>
                <AccordionContent className="space-y-2 px-3 pb-3 pt-0">
                  <CompactSwitchRow
                    label={t('shell.searchIndexing')}
                    hint={t('shell.searchIndexingHint')}
                    checked={currentPage.share?.public?.allowSearchIndexing ?? false}
                    disabled={
                      !currentPage.share?.public?.enabled ||
                      !currentPage.share?.canManagePublic ||
                      updateShare.isPending
                    }
                    onCheckedChange={(checked) =>
                      void updateShareWithToast(
                        { allowSearchIndexing: checked },
                        checked
                          ? t('shell.share.msg.indexingEnabled')
                          : t('shell.share.msg.indexingDisabled')
                      )
                    }
                  />
                  <CompactSwitchRow
                    label={t('shell.attachments')}
                    hint={t('shell.attachmentsHint')}
                    checked={currentPage.share?.public?.includeAttachments ?? false}
                    disabled={
                      !currentPage.share?.public?.enabled ||
                      !currentPage.share?.canManagePublic ||
                      updateShare.isPending
                    }
                    onCheckedChange={(checked) =>
                      void updateShareWithToast(
                        { includeAttachments: checked },
                        checked
                          ? t('shell.share.msg.attachmentsShown')
                          : t('shell.share.msg.attachmentsHidden')
                      )
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            {publicSharePath ? (
              <DetailRow label={t('shell.row.publicLink')}>
                <div className="space-y-2">
                  <div className="text-muted-foreground truncate font-mono text-[11px]">
                    {publicSharePath}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void copyPublicPageLink()}>
                      <Globe2 className="mr-2 h-4 w-4" />
                      {t('shell.copy')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (publicSharePath && typeof window !== 'undefined') {
                          window.open(publicSharePath, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t('shell.open')}
                    </Button>
                    {currentPage.share?.canManagePublic && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateShare.isPending}
                        onClick={() =>
                          void updateShareWithToast(
                            { regenerateToken: true, enablePublic: true },
                            t('shell.share.msg.regenerated')
                          )
                        }
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {t('shell.renew')}
                      </Button>
                    )}
                  </div>
                </div>
              </DetailRow>
            ) : (
              <DetailRow label={t('shell.row.publicLink')} value={t('shell.off')} />
            )}
          </DetailSection>

          <DetailSection title={t('shell.section.outline')} count={currentPageHeadings.length}>
            {currentPageHeadings.length > 0 ? (
              currentPageHeadings.map((heading) => (
                <DetailButtonRow
                  key={heading.id}
                  primary={heading.text}
                  secondary={`H${heading.level}`}
                  inset={(heading.level - 1) * 12}
                />
              ))
            ) : (
              <CompactEmptyState>{t('shell.noHeadings')}</CompactEmptyState>
            )}
          </DetailSection>

          <DetailSection title={t('shell.section.subNotes')} count={currentChildPages.length}>
            {currentChildPages.length > 0 ? (
              currentChildPages.map((childPage) => (
                <button
                  key={childPage.id}
                  type="button"
                  className="w-full"
                  onClick={() =>
                    updateQueryParams({ pageId: childPage.id, spaceId: childPage.spaceId })
                  }
                >
                  <DetailButtonRow
                    icon={
                      <DocumentIcon
                        icon={childPage.icon}
                        className="h-7 w-7 rounded-sm text-[11px]"
                      />
                    }
                    primary={childPage.title}
                    secondary={
                      childPage.excerpt || new Date(childPage.updatedAt).toLocaleDateString()
                    }
                    action={<ChevronRight className="text-muted-foreground h-4 w-4" />}
                  />
                </button>
              ))
            ) : (
              <CompactEmptyState>{t('shell.noSubNotes')}</CompactEmptyState>
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {detailsTab === 'history' ? (
            <DetailSection title={t('shell.section.history')} count={revisions.length}>
              {revisions.length > 0 ? (
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={
                    revisions.find((revision) => revision.revision === currentPage.currentRevision)
                      ?.id
                  }
                  className="overflow-hidden rounded-lg border"
                >
                  {revisions.map((revision) => {
                    const isCurrentRevision = revision.revision === currentPage.currentRevision;
                    const commitMessage = getRevisionCommitMessage(revision, t);

                    return (
                      <AccordionItem
                        key={revision.id}
                        value={revision.id}
                        className="border-border border-b last:border-b-0"
                      >
                        <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-muted-foreground font-mono text-[11px]">
                                {getShortRevisionId(revision.id)}
                              </span>
                              <span className="truncate text-sm font-medium">{commitMessage}</span>
                              {isCurrentRevision && <Badge variant="secondary">{'HEAD'}</Badge>}
                            </div>
                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              <span>{revision.author?.name || t('shell.unknown')}</span>
                              <span>{new Date(revision.createdAt).toLocaleString()}</span>
                              <span>
                                {'r'}
                                {revision.revision}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 pt-0">
                          <div className="border-border space-y-2 border-t pt-3">
                            {revision.changeSummary && (
                              <div className="text-foreground text-xs">
                                {revision.changeSummary}
                              </div>
                            )}
                            <div className="text-muted-foreground text-xs leading-5">
                              {revision.excerpt || t('shell.noPreview')}
                            </div>
                            {canEditCurrentPage && !isCurrentRevision && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => handleRestoreRevision(revision.id)}
                              >
                                <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                                {t('shell.restore')}
                              </Button>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <CompactEmptyState>{t('shell.noRevisions')}</CompactEmptyState>
              )}
            </DetailSection>
          ) : null}
        </TabsContent>

        <TabsContent value="connections" className="mt-0 space-y-3">
          {detailsTab === 'connections' ? (
            <>
              {currentPage.projectId ? (
                <DocumentDiscussionCard pageId={currentPage.id} projectId={currentPage.projectId} />
              ) : null}

              <DetailSection
                title={t('shell.section.relatedTasks')}
                count={currentPage.relatedIssues?.length || 0}
              >
                {canEditCurrentPage && (
                  <div className="flex gap-2">
                    <Select value={issueToAttach} onValueChange={setIssueToAttach}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder={t('shell.attachTask')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(searchableIssues || []).map((issue) => (
                          <SelectItem key={issue.id} value={issue.id}>
                            {issue.key} {'·'} {issue.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleAttachIssue} disabled={!issueToAttach}>
                      {t('shell.link')}
                    </Button>
                  </div>
                )}
                {currentPage.relatedIssues?.length ? (
                  currentPage.relatedIssues.map((issue) => (
                    <div key={issue.id}>
                      <DetailButtonRow
                        primary={issue.key}
                        secondary={issue.title}
                        action={
                          canEditCurrentPage ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDetachIssue(issue.id)}
                            >
                              <Unlink2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null
                        }
                      />
                    </div>
                  ))
                ) : (
                  <CompactEmptyState>{t('shell.noLinkedTasks')}</CompactEmptyState>
                )}
              </DetailSection>

              <DetailSection
                title={t('shell.section.backlinks')}
                count={currentPage.backlinks?.length || 0}
              >
                {currentPage.backlinks?.length ? (
                  currentPage.backlinks.map((backlink) => (
                    <button
                      key={backlink.id}
                      className="w-full"
                      onClick={() =>
                        updateQueryParams({
                          pageId: backlink.id,
                          spaceId: currentPage.space?.id || activeSpace?.id || null,
                        })
                      }
                      type="button"
                    >
                      <DetailButtonRow
                        primary={backlink.title}
                        secondary={backlink.slug}
                        action={<ChevronRight className="text-muted-foreground h-4 w-4" />}
                      />
                    </button>
                  ))
                ) : (
                  <CompactEmptyState>{t('shell.noBacklinks')}</CompactEmptyState>
                )}
              </DetailSection>

              <DetailSection title={t('shell.section.attachments')} count={attachments.length}>
                {attachments.length ? (
                  attachments.map((attachment) => (
                    <div key={attachment.id}>
                      <DetailButtonRow
                        primary={attachment.fileName}
                        secondary={formatFileSize(attachment.fileSize)}
                        action={
                          <div className="flex items-center gap-1">
                            <a
                              href={`/api/uploads/${attachment.filePath.split('/').pop()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:bg-accent inline-flex h-7 items-center rounded-md border px-2 text-xs transition-colors"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {t('shell.open')}
                            </a>
                            {canEditCurrentPage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => deleteAttachment.mutate(attachment.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        }
                      />
                    </div>
                  ))
                ) : (
                  <CompactEmptyState>{t('shell.noAttachments')}</CompactEmptyState>
                )}
              </DetailSection>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  ) : (
    <div className="p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('shell.details.kicker')}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {t('shell.selectPageLeft')}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2 lg:hidden">
          <div className="min-w-0 truncate text-sm font-medium">
            {currentPage?.title || activeSpace?.name || t('shell.docsTitle')}
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={isPagesSheetOpen} onOpenChange={setIsPagesSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  {t('shell.pages')}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[92vw] max-w-md p-0">
                <div className="bg-surface flex h-full min-h-0 flex-col">{navigationPane}</div>
              </SheetContent>
            </Sheet>

            <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8" disabled={!currentPage}>
                  {t('shell.details.kicker')}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[95vw] max-w-[32rem] p-0">
                <div className="bg-background h-full min-h-0 overflow-y-auto overscroll-contain">
                  {detailsPane}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <PageSidebarContent>
          <div className="bg-surface flex h-full min-h-0 flex-col">{navigationPane}</div>
        </PageSidebarContent>

        <div className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-h-0 min-w-0 overflow-hidden">
            {isLoading ? (
              <DocsShellSkeleton />
            ) : currentPage ? (
              <DocumentEditor
                page={currentPage}
                allPages={allPages}
                canEdit={canEditCurrentPage}
                saveError={saveError}
                onSave={handleSavePage}
                onUpdateShare={handleUpdateShare}
                onUploadImage={handleUploadImage}
                onCreateChild={
                  canCreateChildPages
                    ? () => {
                        openCreateDialog(currentPage.id);
                      }
                    : undefined
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="mx-auto max-w-xl px-6">
                  <DocsGettingStarted
                    canCreate={canCreateInContext}
                    hasPages={allPages.length > 0}
                    scopeLabel={scopeLabel}
                    spaceName={createTargetSpace?.name}
                    onCreatePage={() => openCreateDialog(null)}
                  />
                </div>
              </div>
            )}
          </div>

          {currentPage ? (
            <aside className="border-border bg-background hidden h-full min-h-0 overflow-y-auto overscroll-contain border-l lg:block">
              {detailsPane}
            </aside>
          ) : null}
        </div>
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => (open ? setIsCreateDialogOpen(true) : resetCreateDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newPageParentId ? t('shell.dialog.createSubNote') : t('shell.dialog.createNewPage')}
            </DialogTitle>
            <DialogDescription>
              {selectedParentPage
                ? t('shell.dialog.nestedUnder', { title: selectedParentPage.title })
                : t('shell.dialog.createsRoot', {
                    space: createTargetSpace?.name || t('shell.docsTitle'),
                  })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="page-title">{t('shell.dialog.titleLabel')}</Label>
              <Input
                id="page-title"
                value={newPageTitle}
                onChange={(event) => setNewPageTitle(event.target.value)}
                placeholder={t('shell.dialog.titlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t('shell.dialog.iconLabel')}</Label>
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  type="button"
                  className={cn(
                    'text-muted-foreground hover:bg-accent/60 flex h-10 items-center justify-center rounded-md transition-colors duration-150',
                    !newPageIcon && 'bg-primary/10 text-primary'
                  )}
                  onClick={() => setNewPageIcon(null)}
                >
                  <DocumentIcon icon={null} className="h-7 w-7 rounded-sm" />
                </button>
                {DOCUMENT_ICON_OPTIONS.map((iconOption) => (
                  <button
                    key={iconOption}
                    type="button"
                    className={cn(
                      'hover:bg-accent/60 flex h-10 items-center justify-center rounded-md text-xl transition-colors duration-150',
                      newPageIcon === iconOption && 'bg-primary/10 text-primary'
                    )}
                    onClick={() => setNewPageIcon(iconOption)}
                  >
                    {iconOption}
                  </button>
                ))}
              </div>
            </div>
            {!canCreateInContext && (
              <div className="border-destructive/20 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
                {t('shell.dialog.noPermission')}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetCreateDialog}>
              {t('shell.cancel')}
            </Button>
            <Button
              onClick={handleCreatePage}
              disabled={!newPageTitle.trim() || createPage.isPending || !canCreateInContext}
            >
              {createPage.isPending ? t('shell.dialog.creating') : t('shell.dialog.createPage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-150',
            !open && '-rotate-90'
          )}
        />
        <span className="flex-1 truncate text-left">{title}</span>
        {typeof count === 'number' && (
          <span className="text-muted-foreground/70 text-[10px] font-normal normal-case tracking-normal">
            {count}
          </span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

const COLLECTION_TILE_PALETTE = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200',
];

function pickCollectionTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLLECTION_TILE_PALETTE[hash % COLLECTION_TILE_PALETTE.length];
}

function TreeNode({
  node,
  activePageId,
  depth = 0,
  onSelect,
  isCollectionRoot = false,
}: {
  node: DocumentTreeNode;
  activePageId: string | null;
  depth?: number;
  onSelect: (pageId: string) => void;
  isCollectionRoot?: boolean;
}) {
  const t = useTranslations('collab');
  const [open, setOpen] = useState(true);
  const isActive = node.id === activePageId;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        aria-selected={isActive || undefined}
        data-active={isActive || undefined}
        className="row-interactive group flex items-center gap-1 px-1.5 py-1 text-sm"
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        <button
          type="button"
          className={cn(
            'text-muted-foreground hover:bg-accent/60 flex h-5 w-5 items-center justify-center rounded-sm transition-colors duration-150',
            !hasChildren && 'opacity-0'
          )}
          onClick={() => setOpen((value) => !value)}
          aria-label={hasChildren ? (open ? t('shell.collapse') : t('shell.expand')) : undefined}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(node.id)}
        >
          {isCollectionRoot ? (
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none',
                pickCollectionTone(node.id)
              )}
            >
              {node.icon || node.title.charAt(0).toUpperCase()}
            </span>
          ) : (
            <DocumentIcon icon={node.icon} className="h-5 w-5 rounded-sm text-[10px]" />
          )}
          <span
            className={cn('min-w-0 flex-1 truncate text-sm', isCollectionRoot && 'font-medium')}
          >
            {node.title}
          </span>
          {hasChildren && (
            <span className="text-muted-foreground text-[11px]">{node.children.length}</span>
          )}
        </button>
      </div>

      {open && hasChildren && (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activePageId={activePageId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getShortRevisionId(revisionId: string) {
  return revisionId.slice(0, 7);
}

function getRevisionCommitMessage(
  revision: {
    changeSummary?: string | null;
    revision: number;
    title: string;
  },
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (revision.changeSummary?.trim()) {
    return revision.changeSummary.trim();
  }

  if (revision.revision === 1) {
    return t('shell.revision.initialDraft', { title: revision.title });
  }

  return t('shell.revision.updated', { title: revision.title });
}

function DetailSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="kicker">{title}</span>
        {typeof count === 'number' && (
          <span className="text-muted-foreground text-xs">{count}</span>
        )}
      </div>
      <div className="divide-border divide-y">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="text-muted-foreground min-w-0 text-xs">{label}</div>
      <div
        className={cn(
          'text-foreground min-w-0 flex-1 text-sm',
          children ? 'text-left' : 'text-right'
        )}
      >
        {children ?? value}
      </div>
    </div>
  );
}

function DetailButtonRow({
  icon,
  primary,
  secondary,
  action,
  inset = 0,
}: {
  icon?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  action?: ReactNode;
  inset?: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ paddingLeft: `${16 + inset}px` }}>
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-sm">{primary}</div>
        {secondary ? (
          <div className="text-muted-foreground truncate text-xs">{secondary}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CompactSwitchRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="surface-inset flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function CompactEmptyState({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground px-4 py-4 text-sm">{children}</div>;
}

function sortDocumentPages(left: DocumentPageSummary, right: DocumentPageSummary) {
  const positionDelta = left.position - right.position;
  if (positionDelta !== 0) {
    return positionDelta;
  }

  return left.title.localeCompare(right.title);
}

function DocsTreeSkeleton() {
  const rowWidths = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3', 'w-4/5', 'w-1/2', 'w-9/12', 'w-3/5'];
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className="space-y-1 px-1 py-1"
      data-testid="docs-tree-skeleton"
    >
      {rowWidths.map((width, index) => (
        <div key={index} className="flex items-center gap-2 px-1.5 py-1">
          <div className="shimmer h-4 w-4 shrink-0 rounded-sm" />
          <div className={cn('shimmer h-3.5 rounded-sm', width)} />
        </div>
      ))}
    </div>
  );
}

function DocsShellSkeleton() {
  const paragraphWidths = [
    'w-11/12',
    'w-10/12',
    'w-9/12',
    'w-11/12',
    'w-8/12',
    'w-10/12',
    'w-7/12',
  ];
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="docs-shell-skeleton"
    >
      <div className="border-border border-b px-8 py-5">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="shimmer h-8 w-8 rounded-md" />
            <div className="shimmer h-4 w-40 rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <div className="shimmer h-6 w-24 rounded-sm" />
            <div className="shimmer h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-8 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="shimmer h-3 w-24 rounded-sm" />
          <div className="shimmer h-9 w-3/4 rounded-md" />
          <div className="mt-2 space-y-3">
            {paragraphWidths.map((width, index) => (
              <div key={index} className={cn('shimmer h-4 rounded-sm', width)} />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <div className="shimmer h-4 w-5/6 rounded-sm" />
            <div className="shimmer h-4 w-2/3 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
