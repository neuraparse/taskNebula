'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useAttachIssueDoc, useDetachIssueDoc, useDocumentSearch, useIssueDocs } from '@/lib/hooks/use-docs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createDocumentAppHref } from '@/lib/docs/content';
import { useToast } from '@/hooks/use-toast';
import { DocumentIcon } from '@/components/docs/document-icon';
import { Loader2, FileText, Link2, Plus, Unlink2, ExternalLink } from 'lucide-react';

interface IssueDocsProps {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectId: string;
}

export function IssueDocs({ issueId, issueKey, issueTitle, projectId }: IssueDocsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { currentOrganizationId } = useOrganization();
  const [search, setSearch] = useState('');
  const { data: docs, isLoading } = useIssueDocs(issueId);
  const attachDoc = useAttachIssueDoc(issueId);
  const detachDoc = useDetachIssueDoc(issueId);
  const { data: searchResults = [] } = useDocumentSearch({
    query: search,
    organizationId: currentOrganizationId,
    projectId,
    enabled: search.trim().length > 1,
  });

  const linkedDocIds = new Set((docs || []).map((doc) => doc.id));
  const availableResults = searchResults.filter((doc) => !linkedDocIds.has(doc.id));

  async function handleCreateSpecDoc() {
    try {
      const result = await attachDoc.mutateAsync({ createNew: true, title: `${issueKey} Spec` });
      const createdPage = result?.page;

      toast({
        title: 'Spec doc created',
        description: createdPage
          ? `"${createdPage.title}" was linked to ${issueKey}.`
          : `A new spec doc was linked to ${issueKey}.`,
      });

      if (createdPage?.id) {
        router.push(
          createDocumentAppHref({
            id: createdPage.id,
            spaceId: createdPage.spaceId,
            projectId: createdPage.projectId,
          })
        );
      }
    } catch (error) {
      toast({
        title: 'Could not create spec doc',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  async function handleAttachExisting(pageId: string, title: string) {
    try {
      await attachDoc.mutateAsync({ pageId });
      setSearch('');
      toast({
        title: 'Doc linked',
        description: `"${title}" is now connected to ${issueKey}.`,
      });
    } catch (error) {
      toast({
        title: 'Could not link doc',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  async function handleDetach(pageId: string, title: string) {
    try {
      await detachDoc.mutateAsync(pageId);
      toast({
        title: 'Doc unlinked',
        description: `"${title}" was removed from ${issueKey}.`,
      });
    } catch (error) {
      toast({
        title: 'Could not unlink doc',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Related Docs</h3>
          <span className="text-xs text-muted-foreground">({docs?.length || 0})</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => void handleCreateSpecDoc()}
          disabled={attachDoc.isPending}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Spec Doc
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Attach Existing</div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search project docs..."
        />
        {search.trim().length > 1 && (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {availableResults.length > 0 ? (
              availableResults.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className="flex w-full items-start justify-between rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  onClick={() => void handleAttachExisting(doc.id, doc.title)}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <DocumentIcon icon={doc.icon} className="h-10 w-10 rounded-xl text-base" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{doc.title}</div>
                      {doc.excerpt && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.excerpt}</div>}
                    </div>
                  </div>
                  <div className="mt-1 shrink-0 text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No matching docs found.
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs && docs.length > 0 ? (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <DocumentIcon icon={doc.icon} className="h-11 w-11 rounded-2xl text-base" />
                  <div className="min-w-0">
                    <Link
                      href={createDocumentAppHref({
                        id: doc.id,
                        spaceId: doc.spaceId,
                        projectId: doc.projectId,
                      })}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {doc.title}
                    </Link>
                    {doc.excerpt && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.excerpt}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" size="sm">
                        Linked
                      </Badge>
                      <Badge variant="secondary" size="sm">
                        {doc.projectId ? 'Project Doc' : 'Wiki'}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Updated {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <Link
                      href={createDocumentAppHref({
                        id: doc.id,
                        spaceId: doc.spaceId,
                        projectId: doc.projectId,
                      })}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void handleDetach(doc.id, doc.title)}
                    disabled={detachDoc.isPending}
                  >
                    <Unlink2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">No docs linked yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Link design notes, specs, or runbooks to keep context close to the task.
          </p>
        </div>
      )}
    </div>
  );
}
