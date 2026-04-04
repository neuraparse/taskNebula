'use client';
import { type ReactNode, useEffect, useState } from 'react';
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
  type DocumentShareUpdateInput,
  type DocumentTreeNode,
} from '@/lib/hooks/use-docs';
import { DocumentEditor } from './document-editor';
import { DocsGettingStarted } from './docs-getting-started';
import { DocumentDiscussionCard } from '@/components/chat/document-discussion-card';
import { extractDocumentHeadings } from '@/lib/docs/content';
import { buildDocumentTree } from '@/lib/docs/tree';
import { formatFileSize } from '@/lib/hooks/use-attachments';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DOCUMENT_ICON_OPTIONS, DocumentIcon } from './document-icon';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  Globe2,
  Loader2,
  RefreshCcw,
  Search,
  Share2,
  Trash2,
  Unlink2,
} from 'lucide-react';

interface DocsShellProps {
  projectId?: string;
}

export function DocsShell({ projectId }: DocsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentOrganizationId } = useOrganization();
  const { toast } = useToast();

  const [pageSearch, setPageSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageIcon, setNewPageIcon] = useState<string | null>(null);
  const [newPageParentId, setNewPageParentId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [issueToAttach, setIssueToAttach] = useState<string>('');
  const [isPagesSheetOpen, setIsPagesSheetOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);

  const selectedPageId = searchParams.get('pageId');
  const selectedSpaceId = searchParams.get('spaceId');

  const { data: spaces } = useDocumentSpaces({
    organizationId: currentOrganizationId,
    projectId: projectId || null,
  });

  const {
    data: pagesData,
    isLoading: pagesLoading,
  } = useDocumentPages({
    spaceId: selectedSpaceId,
    organizationId: currentOrganizationId,
    projectId: projectId || null,
  });

  const { data: currentPage, isLoading: pageLoading } = useDocumentPage(selectedPageId);
  const { data: revisions = [] } = useDocumentRevisions(selectedPageId);
  const { data: attachments = [] } = useDocumentAttachments(selectedPageId);
  const createPage = useCreateDocumentPage();
  const updatePage = useUpdateDocumentPage();
  const restorePage = useRestoreDocumentPage();
  const updateShare = useUpdateDocumentShare(selectedPageId);
  const uploadAttachment = useUploadDocumentAttachment(selectedPageId || '');
  const deleteAttachment = useDeleteDocumentAttachment(selectedPageId || '');
  const { data: searchableIssues } = useIssues({ projectId: currentPage?.projectId || undefined });

  const activeSpace = currentPage?.space || pagesData?.space || spaces?.[0] || null;
  const allPages = pagesData?.pages || [];
  const createTargetSpace = activeSpace || spaces?.find((space) => space.permissions?.canCreate) || spaces?.[0] || null;
  const pagePermissions = currentPage?.permissions || activeSpace?.permissions || createTargetSpace?.permissions || null;
  const canEditCurrentPage = !!pagePermissions?.canEdit;
  const canCreateChildPages = !!pagePermissions?.canCreate;
  const canCreateInContext =
    createTargetSpace?.permissions?.canCreate ??
    spaces?.some((space) => space.permissions?.canCreate) ??
    Boolean(projectId || currentOrganizationId);
  const scopeLabel = projectId ? 'Project docs' : 'Organization wiki';

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
  const selectedParentPage = newPageParentId ? allPages.find((page) => page.id === newPageParentId) || null : null;
  const currentPageHeadings = currentPage ? extractDocumentHeadings(currentPage.contentJson) : [];
  const currentPageWordCount = currentPage?.contentText
    ? currentPage.contentText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const currentChildPages = currentPage
    ? [...allPages]
        .filter((page) => page.parentId === currentPage.id)
        .sort(sortDocumentPages)
    : [];
  const currentSharePath = currentPage?.share?.internalPath || (currentPage ? `${pathname}?pageId=${currentPage.id}&spaceId=${currentPage.spaceId}` : null);
  const publicSharePath = currentPage?.share?.public?.enabled ? currentPage.share.public.urlPath : null;

  useEffect(() => {
    if (!selectedSpaceId && pagesData?.space?.id) {
      updateQueryParams({ spaceId: pagesData.space.id, pageId: selectedPageId });
    }
  }, [pagesData?.space?.id, selectedSpaceId, selectedPageId]);

  useEffect(() => {
    const firstPage = pagesData?.pages?.[0];
    if (!selectedPageId && firstPage) {
      updateQueryParams({
        pageId: firstPage.id,
        spaceId: pagesData.space?.id || selectedSpaceId || undefined,
      });
    }
  }, [pagesData?.pages, pagesData?.space?.id, selectedPageId, selectedSpaceId]);

  useEffect(() => {
    if (currentPage?.space?.id && currentPage.space.id !== selectedSpaceId) {
      updateQueryParams({ pageId: currentPage.id, spaceId: currentPage.space.id });
    }
  }, [currentPage?.id, currentPage?.space?.id, selectedSpaceId]);

  function updateQueryParams(next: { pageId?: string | null; spaceId?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.pageId) params.set('pageId', next.pageId);
    if (next.spaceId) params.set('spaceId', next.spaceId);
    if (next.pageId === null) params.delete('pageId');
    if (next.spaceId === null) params.delete('spaceId');

    router.replace(`${pathname}?${params.toString()}`);
    setIsPagesSheetOpen(false);
    setIsDetailsSheetOpen(false);
  }

  async function handleCreatePage() {
    if (!newPageTitle.trim()) {
      return;
    }

    if (!canCreateInContext) {
      toast({
        title: 'Page creation is disabled',
        description: 'You need edit access in this docs space to create a page.',
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
        title: 'Page created',
        description: `"${page.title}" is ready for editing.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to create page',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  function openCreateDialog(parentId: string | null = null) {
    if (!canCreateInContext) {
      toast({
        title: 'Page creation is disabled',
        description: 'You need edit access in this docs space to create a page.',
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

  async function handleSavePage(
    data: { title: string; icon: string | null; contentJson: Record<string, any>; expectedRevision: number }
  ): Promise<DocumentPage> {
    if (!selectedPageId) {
      throw new Error('Open a page before saving');
    }

    setSaveError(null);
    try {
      const page = await updatePage.mutateAsync({
        pageId: selectedPageId,
        data,
      });
      return page;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save page';
      setSaveError(message);

      const maybeError = error as Error & { status?: number };
      if (maybeError.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
        queryClient.invalidateQueries({ queryKey: ['document-revisions', selectedPageId] });
      }

      toast({
        title: 'Save failed',
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
        title: 'Revision restored',
        description: 'A new head revision was created from the selected history entry.',
      });
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Unable to restore revision',
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

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to link issue');
      }

      setIssueToAttach('');
      queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
      queryClient.invalidateQueries({ queryKey: ['issue-docs', issueToAttach] });
      toast({
        title: 'Task linked',
        description: 'The selected task is now related to this document.',
      });
    } catch (error) {
      toast({
        title: 'Could not link task',
        description: error instanceof Error ? error.message : 'Something went wrong',
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

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to unlink task');
      }

      queryClient.invalidateQueries({ queryKey: ['document-page', selectedPageId] });
      queryClient.invalidateQueries({ queryKey: ['issue-docs', issueId] });
      toast({
        title: 'Task unlinked',
        description: 'The task was removed from this document.',
      });
    } catch (error) {
      toast({
        title: 'Could not unlink task',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  async function handleUploadImage(file: File) {
    if (!selectedPageId) {
      throw new Error('Open a page before uploading an image');
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
      typeof window !== 'undefined' ? `${window.location.origin}${currentSharePath}` : currentSharePath;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined') {
        window.prompt('Copy this page link', value);
      }

      toast({
        title: 'Page link copied',
        description: 'Only signed-in members with access to this doc can open it.',
      });
    } catch {
      toast({
        title: 'Could not copy page link',
        description: 'Clipboard access was blocked in this browser.',
        variant: 'destructive',
      });
    }
  }

  async function copyPublicPageLink() {
    if (!publicSharePath) {
      return;
    }

    const value =
      typeof window !== 'undefined' ? `${window.location.origin}${publicSharePath}` : publicSharePath;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (typeof window !== 'undefined') {
        window.prompt('Copy this public page link', value);
      }

      toast({
        title: 'Public link copied',
        description: 'This link can be opened without signing in while public access stays enabled.',
      });
    } catch {
      toast({
        title: 'Could not copy public link',
        description: 'Clipboard access was blocked in this browser.',
        variant: 'destructive',
      });
    }
  }

  async function handleUpdateShare(data: DocumentShareUpdateInput): Promise<DocumentPage> {
    if (!selectedPageId) {
      throw new Error('Open a page before updating sharing');
    }

    return updateShare.mutateAsync(data);
  }

  async function updateShareWithToast(data: DocumentShareUpdateInput, successMessage: string) {
    try {
      await handleUpdateShare(data);
      toast({
        title: 'Sharing updated',
        description: successMessage,
      });
    } catch (error) {
      toast({
        title: 'Could not update sharing',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  const isLoading = pagesLoading || (selectedPageId ? pageLoading : false);
  const navigationPane = (
    <>
      <div className="border-b border-border/60 p-4">
        <div className="rounded-lg border bg-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-transparent text-foreground">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {scopeLabel}
              </div>
              <div className="mt-1 truncate text-base font-semibold tracking-tight">
                {activeSpace?.name || 'Docs'}
              </div>
            </div>
            <div className="rounded-md border bg-transparent px-2 py-1 text-[11px] text-muted-foreground">
              {allPages.length} notes
            </div>
          </div>

          {spaces && spaces.length > 1 && (
            <div className="mt-3">
              <Select
                value={activeSpace?.id}
                onValueChange={(spaceId) => {
                  updateQueryParams({ spaceId, pageId: null });
                }}
              >
                <SelectTrigger className="h-9 rounded-md bg-transparent">
                  <SelectValue placeholder="Select space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={pageSearch}
                onChange={(event) => setPageSearch(event.target.value)}
                placeholder="Search docs..."
                className="h-9 rounded-md bg-transparent pl-9 shadow-none"
              />
            </div>
            <Button
              size="sm"
              className="h-9 rounded-md px-3"
              onClick={() => openCreateDialog(null)}
              disabled={!canCreateInContext}
            >
              <FilePlus2 className="mr-2 h-4 w-4" />
              New
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-3">
        <div className="rounded-lg border bg-transparent p-2">
          {showSearchResults ? (
            <div className="space-y-1">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="w-full rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-muted/10"
                    onClick={() => {
                      setPageSearch('');
                      updateQueryParams({ pageId: result.id, spaceId: result.spaceId });
                    }}
                    type="button"
                  >
                    <div className="flex items-start gap-2.5">
                      <DocumentIcon icon={result.icon} className="h-8 w-8 rounded-md text-xs" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{result.title}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{result.spaceName}</div>
                        {result.excerpt && <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{result.excerpt}</div>}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  No matching docs found.
                </div>
              )}
            </div>
          ) : tree.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between px-2 py-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Notes</div>
                <span className="text-[11px] text-muted-foreground">Curated</span>
              </div>
              <div className="space-y-0.5">
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    activePageId={selectedPageId}
                    onSelect={(pageId) => updateQueryParams({ pageId, spaceId: activeSpace?.id || null })}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 p-5 text-center">
              <div className="text-sm font-medium">No notes yet</div>
              <div className="mt-1 text-xs text-muted-foreground">Start with a root page</div>
              <Button className="mt-3 h-8 rounded-md" size="sm" onClick={() => openCreateDialog(null)} disabled={!canCreateInContext}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                New Page
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const detailsPane = currentPage ? (
    <div className="min-h-full bg-background">
      <div className="border-b border-border px-4 pb-4 pt-4 pr-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Details</div>
        <div className="mt-3 flex items-start gap-3">
          <DocumentIcon icon={currentPage.icon} className="h-9 w-9 rounded-md text-sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold tracking-tight">{currentPage.title}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {currentPage.projectId ? 'Project doc' : 'Workspace note'}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex min-h-full flex-col gap-4 p-4">
        <TabsList className="grid h-9 grid-cols-3 rounded-lg border bg-transparent p-1">
          <TabsTrigger value="overview" className="rounded-md text-[13px] font-medium data-[state=active]:bg-muted/10 data-[state=active]:shadow-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-md text-[13px] font-medium data-[state=active]:bg-muted/10 data-[state=active]:shadow-none">
            History
          </TabsTrigger>
          <TabsTrigger value="connections" className="rounded-md text-[13px] font-medium data-[state=active]:bg-muted/10 data-[state=active]:shadow-none">
            Links
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-3">
          <DetailSection title="Overview">
            <DetailRow label="Page">
              <div className="flex items-start gap-3">
                <DocumentIcon icon={currentPage.icon} className="h-8 w-8 rounded-md text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{currentPage.title}</div>
                  {currentPage.excerpt && (
                    <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{currentPage.excerpt}</div>
                  )}
                </div>
              </div>
            </DetailRow>
            <DetailRow label="Type" value={currentPage.projectId ? 'Project Doc' : 'Wiki Page'} />
            <DetailRow
              label="Visibility"
              value={currentPage.share?.public?.enabled ? 'Workspace + public' : 'Workspace only'}
            />
            <DetailRow label="Updated" value={new Date(currentPage.updatedAt).toLocaleDateString()} />
            <DetailRow label="Words" value={currentPageWordCount} />
            <DetailRow label="Revisions" value={currentPage.revisionCount || revisions.length} />
            <DetailRow label="Sub-notes" value={currentChildPages.length} />
          </DetailSection>

          <DetailSection title="Sharing">
            <DetailRow label="Workspace link">
              <div className="space-y-2">
                <div className="truncate font-mono text-[11px] text-muted-foreground">{currentSharePath || '/docs'}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyCurrentPageLink()}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Copy
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
                    Open
                  </Button>
                </div>
              </div>
            </DetailRow>
            <DetailRow label="Public access">
              <div className="flex items-center gap-3">
                <Switch
                  checked={currentPage.share?.public?.enabled}
                  disabled={!currentPage.share?.canManagePublic || updateShare.isPending}
                  onCheckedChange={(checked) =>
                    void updateShareWithToast(
                      { enablePublic: checked },
                      checked
                        ? 'This page is now available on a public link.'
                        : 'Public access has been disabled for this page.'
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {currentPage.share?.public?.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </DetailRow>
            <Accordion type="single" collapsible className="rounded-lg border">
              <AccordionItem value="public-settings" className="border-b-0">
                <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                  Advanced public settings
                </AccordionTrigger>
                <AccordionContent className="space-y-2 px-3 pb-3 pt-0">
                  <CompactSwitchRow
                    label="Search indexing"
                    hint="Allow search engines"
                    checked={currentPage.share?.public?.allowSearchIndexing}
                    disabled={!currentPage.share?.public?.enabled || !currentPage.share?.canManagePublic || updateShare.isPending}
                    onCheckedChange={(checked) =>
                      void updateShareWithToast(
                        { allowSearchIndexing: checked },
                        checked
                          ? 'Search indexing is enabled for the public page.'
                          : 'Search indexing is disabled for the public page.'
                      )
                    }
                  />
                  <CompactSwitchRow
                    label="Attachments"
                    hint="Publish uploaded files"
                    checked={currentPage.share?.public?.includeAttachments}
                    disabled={!currentPage.share?.public?.enabled || !currentPage.share?.canManagePublic || updateShare.isPending}
                    onCheckedChange={(checked) =>
                      void updateShareWithToast(
                        { includeAttachments: checked },
                        checked
                          ? 'Uploaded attachments are now visible on the public page.'
                          : 'Uploaded attachments are hidden from the public page.'
                      )
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            {publicSharePath ? (
              <DetailRow label="Public link">
                <div className="space-y-2">
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{publicSharePath}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void copyPublicPageLink()}>
                      <Globe2 className="mr-2 h-4 w-4" />
                      Copy
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
                      Open
                    </Button>
                    {currentPage.share?.canManagePublic && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateShare.isPending}
                        onClick={() =>
                          void updateShareWithToast(
                            { regenerateToken: true, enablePublic: true },
                            'A fresh public link has been generated and the previous one no longer works.'
                          )
                        }
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Renew
                      </Button>
                    )}
                  </div>
                </div>
              </DetailRow>
            ) : (
              <DetailRow label="Public link" value="Off" />
            )}
          </DetailSection>

          <DetailSection title="Outline" count={currentPageHeadings.length}>
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
              <CompactEmptyState>No headings yet.</CompactEmptyState>
            )}
          </DetailSection>

          <DetailSection title="Sub-notes" count={currentChildPages.length}>
            {currentChildPages.length > 0 ? (
              currentChildPages.map((childPage) => (
                <button
                  key={childPage.id}
                  type="button"
                  className="w-full"
                  onClick={() => updateQueryParams({ pageId: childPage.id, spaceId: childPage.spaceId })}
                >
                  <DetailButtonRow
                    icon={<DocumentIcon icon={childPage.icon} className="h-7 w-7 rounded-md text-[11px]" />}
                    primary={childPage.title}
                    secondary={childPage.excerpt || new Date(childPage.updatedAt).toLocaleDateString()}
                    action={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  />
                </button>
              ))
            ) : (
              <CompactEmptyState>No sub-notes</CompactEmptyState>
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <DetailSection title="History" count={revisions.length}>
            {revisions.length > 0 ? (
              <Accordion
                type="single"
                collapsible
                defaultValue={revisions.find((revision) => revision.revision === currentPage.currentRevision)?.id}
                className="overflow-hidden rounded-lg border"
              >
                {revisions.map((revision) => {
                  const isCurrentRevision = revision.revision === currentPage.currentRevision;
                  const commitMessage = getRevisionCommitMessage(revision);

                  return (
                    <AccordionItem key={revision.id} value={revision.id} className="border-b border-border/70 last:border-b-0">
                      <AccordionTrigger className="px-3 py-2.5 hover:no-underline">
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">{getShortRevisionId(revision.id)}</span>
                            <span className="truncate text-sm font-medium">{commitMessage}</span>
                            {isCurrentRevision && <Badge variant="secondary">HEAD</Badge>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{revision.author?.name || 'Unknown'}</span>
                            <span>{new Date(revision.createdAt).toLocaleString()}</span>
                            <span>r{revision.revision}</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-0">
                        <div className="space-y-2 border-t border-border/70 pt-3">
                          {revision.changeSummary && <div className="text-xs text-foreground">{revision.changeSummary}</div>}
                          <div className="text-xs leading-5 text-muted-foreground">
                            {revision.excerpt || 'No preview.'}
                          </div>
                          {canEditCurrentPage && !isCurrentRevision && (
                            <Button variant="outline" size="sm" className="h-8" onClick={() => handleRestoreRevision(revision.id)}>
                              <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <CompactEmptyState>No revisions yet.</CompactEmptyState>
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="connections" className="mt-0 space-y-3">
          {currentPage.projectId ? (
            <DocumentDiscussionCard pageId={currentPage.id} projectId={currentPage.projectId} />
          ) : null}

          <DetailSection title="Related Tasks" count={currentPage.relatedIssues?.length || 0}>
            {canEditCurrentPage && (
              <div className="flex gap-2">
                <Select value={issueToAttach} onValueChange={setIssueToAttach}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Attach a task" />
                  </SelectTrigger>
                  <SelectContent>
                    {(searchableIssues || []).map((issue) => (
                      <SelectItem key={issue.id} value={issue.id}>
                        {issue.key} · {issue.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAttachIssue} disabled={!issueToAttach}>
                  Link
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDetachIssue(issue.id)}>
                          <Unlink2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null
                    }
                  />
                </div>
              ))
            ) : (
              <CompactEmptyState>No linked tasks yet.</CompactEmptyState>
            )}
          </DetailSection>

          <DetailSection title="Backlinks" count={currentPage.backlinks?.length || 0}>
            {currentPage.backlinks?.length ? (
              currentPage.backlinks.map((backlink) => (
                <button
                  key={backlink.id}
                  className="w-full"
                  onClick={() =>
                    updateQueryParams({ pageId: backlink.id, spaceId: currentPage.space?.id || activeSpace?.id || null })
                  }
                  type="button"
                >
                  <DetailButtonRow
                    primary={backlink.title}
                    secondary={backlink.slug}
                    action={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  />
                </button>
              ))
            ) : (
              <CompactEmptyState>No backlinks yet.</CompactEmptyState>
            )}
          </DetailSection>

          <DetailSection title="Attachments" count={attachments.length}>
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
                          className="inline-flex h-7 items-center rounded-md border px-2 text-xs transition-colors hover:bg-accent"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Open
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
              <CompactEmptyState>No attachments yet.</CompactEmptyState>
            )}
          </DetailSection>
        </TabsContent>
      </Tabs>
    </div>
  ) : (
    <div className="p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Select a page from the left.
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-background px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {currentPage && <DocumentIcon icon={currentPage.icon} className="h-9 w-9 rounded-md text-sm" />}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">{currentPage?.title || activeSpace?.name || 'Docs'}</div>
              <div className="truncate text-xs text-muted-foreground">
                {currentPage ? currentPage.slug : scopeLabel}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet open={isPagesSheetOpen} onOpenChange={setIsPagesSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-md xl:hidden">
                  Pages
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[92vw] max-w-md p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-md [&>button]:border [&>button]:border-border [&>button]:bg-transparent [&>button]:opacity-100 [&>button]:shadow-none [&>button:hover]:bg-muted/10 [&>button_svg]:h-3.5 [&>button_svg]:w-3.5"
              >
                <div className="flex h-full min-h-0 flex-col bg-background">
                  {navigationPane}
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-md" disabled={!currentPage}>
                  Details
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[95vw] max-w-[32rem] p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-md [&>button]:border [&>button]:border-border [&>button]:bg-transparent [&>button]:opacity-100 [&>button]:shadow-none [&>button:hover]:bg-muted/10 [&>button_svg]:h-3.5 [&>button_svg]:w-3.5"
              >
                <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-background">
                  {detailsPane}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="hidden h-full min-h-0 flex-col border-r border-border/60 bg-background xl:flex">
            {navigationPane}
          </div>

          <div className="min-h-0 min-w-0 overflow-hidden">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
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
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => (open ? setIsCreateDialogOpen(true) : resetCreateDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newPageParentId ? 'Create Sub-note' : 'Create New Page'}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedParentPage
                ? `This page will be nested under ${selectedParentPage.title}.`
                : `This will create a root page in ${createTargetSpace?.name || 'Docs'}.`}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="page-title">Title</Label>
              <Input
                id="page-title"
                value={newPageTitle}
                onChange={(event) => setNewPageTitle(event.target.value)}
                placeholder="Release plan, onboarding guide, architecture notes..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-6 gap-2 rounded-lg border bg-transparent p-3">
                <button
                  type="button"
                  className={cn(
                    'flex h-10 items-center justify-center rounded-md border border-border/70 bg-transparent text-muted-foreground transition-colors hover:bg-muted/10',
                    !newPageIcon && 'border-border bg-muted/10 text-foreground'
                  )}
                  onClick={() => setNewPageIcon(null)}
                >
                  <DocumentIcon icon={null} className="h-8 w-8 rounded-md" />
                </button>
                {DOCUMENT_ICON_OPTIONS.map((iconOption) => (
                  <button
                    key={iconOption}
                    type="button"
                    className={cn(
                      'flex h-10 items-center justify-center rounded-md border border-border/70 bg-transparent text-xl transition-colors hover:bg-muted/10',
                      newPageIcon === iconOption && 'border-border bg-muted/10 text-foreground'
                    )}
                    onClick={() => setNewPageIcon(iconOption)}
                  >
                    {iconOption}
                  </button>
                ))}
              </div>
            </div>
            {selectedParentPage && (
              <div className="rounded-lg border bg-transparent px-3 py-2 text-sm text-muted-foreground">
                Parent page: <span className="font-medium text-foreground">{selectedParentPage.title}</span>
              </div>
            )}
            <div className="rounded-lg border bg-transparent px-3 py-2 text-sm text-muted-foreground">
              Opens immediately with autosave enabled.
            </div>
            {!canCreateInContext && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                You do not have permission to create docs in this space.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetCreateDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={!newPageTitle.trim() || createPage.isPending || !canCreateInContext}>
              {createPage.isPending ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TreeNode({
  node,
  activePageId,
  depth = 0,
  onSelect,
}: {
  node: DocumentTreeNode;
  activePageId: string | null;
  depth?: number;
  onSelect: (pageId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isActive = node.id === activePageId;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center gap-1 rounded-md border border-transparent px-2.5 py-2 text-sm text-foreground/90 transition-colors hover:border-border hover:bg-muted/10',
          isActive && 'border-border bg-muted/10 text-foreground'
        )}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        {depth > 0 && (
          <div
            className="absolute bottom-1.5 top-1.5 w-px bg-border/50"
            style={{ left: `${depth * 14 + 4}px` }}
          />
        )}
        <button
          type="button"
          className={cn('flex h-5 w-5 items-center justify-center rounded', !hasChildren && 'opacity-0')}
          onClick={() => setOpen((value) => !value)}
        >
          {hasChildren ? (
            open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(node.id)}>
          <DocumentIcon
            icon={node.icon}
            className={cn('h-7 w-7 rounded-md text-[11px] transition-transform', isActive && 'scale-[1.03]')}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium tracking-tight">{node.title}</div>
          </div>
          {hasChildren && (
            <span className="rounded-md border bg-transparent px-2 py-0.5 text-[10px] text-muted-foreground">
              {node.children.length}
            </span>
          )}
        </button>
      </div>

      {open && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} activePageId={activePageId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function getShortRevisionId(revisionId: string) {
  return revisionId.slice(0, 7);
}

function getRevisionCommitMessage(revision: {
  changeSummary?: string | null;
  revision: number;
  title: string;
}) {
  if (revision.changeSummary?.trim()) {
    return revision.changeSummary.trim();
  }

  if (revision.revision === 1) {
    return `Initial draft of ${revision.title}`;
  }

  return `Updated ${revision.title}`;
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
    <section className="overflow-hidden rounded-lg border bg-transparent">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        {typeof count === 'number' && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
      </div>
      <div className="divide-y divide-border/70">{children}</div>
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
    <div className="flex items-start justify-between gap-4 px-3 py-2.5">
      <div className="min-w-0 text-xs text-muted-foreground">{label}</div>
      <div className={cn('min-w-0 flex-1 text-sm text-foreground', children ? 'text-left' : 'text-right')}>
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
    <div className="flex items-center gap-3 px-3 py-2.5" style={{ paddingLeft: `${12 + inset}px` }}>
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{primary}</div>
        {secondary ? <div className="truncate text-xs text-muted-foreground">{secondary}</div> : null}
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
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-transparent px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function CompactEmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">{children}</div>;
}

function sortDocumentPages(left: DocumentPage, right: DocumentPage) {
  const positionDelta = left.position - right.position;
  if (positionDelta !== 0) {
    return positionDelta;
  }

  return left.title.localeCompare(right.title);
}
