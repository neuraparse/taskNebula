'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useAttachIssueDoc, useDetachIssueDoc, useDocumentSearch, useIssueDocs } from '@/lib/hooks/use-docs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const [showAll, setShowAll] = useState(false);
  const linkedDocIds = new Set((docs || []).map((doc) => doc.id));
  const availableResults = searchResults.filter((doc) => !linkedDocIds.has(doc.id));
  const SHOW_LIMIT = 5;

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

  const visibleDocs = showAll ? (docs || []) : (docs || []).slice(0, SHOW_LIMIT);

  return (
    <div className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
          onClick={() => void handleCreateSpecDoc()}
          disabled={attachDoc.isPending}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create spec
        </Button>
      </div>

      {/* Search to attach existing */}
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search docs to link..."
        className="h-8 text-sm"
      />
      {search.trim().length > 1 && (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {availableResults.length > 0 ? (
            availableResults.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="row-interactive flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left"
                onClick={() => void handleAttachExisting(doc.id, doc.title)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <DocumentIcon icon={doc.icon} className="h-7 w-7 rounded-md text-sm shrink-0" />
                  <span className="truncate text-sm font-medium">{doc.title}</span>
                </div>
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">No matching docs found.</p>
          )}
        </div>
      )}

      {/* Linked docs list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : docs && docs.length > 0 ? (
        <div className="space-y-1">
          {visibleDocs.map((doc) => (
            <div
              key={doc.id}
              className="row-interactive group flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <DocumentIcon icon={doc.icon} className="h-7 w-7 rounded-md text-sm shrink-0" />
                <div className="min-w-0">
                  <Link
                    href={createDocumentAppHref({
                      id: doc.id,
                      spaceId: doc.spaceId,
                      projectId: doc.projectId,
                    })}
                    className="block truncate text-sm font-medium hover:text-primary transition-colors duration-200"
                  >
                    {doc.title}
                  </Link>
                  <span className="text-[11px] text-muted-foreground">
                    {doc.projectId ? 'Project doc' : 'Wiki'} · Updated {new Date(doc.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                  <Link
                    href={createDocumentAppHref({
                      id: doc.id,
                      spaceId: doc.spaceId,
                      projectId: doc.projectId,
                    })}
                    aria-label="Open doc"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => void handleDetach(doc.id, doc.title)}
                  disabled={detachDoc.isPending}
                  aria-label="Unlink doc"
                >
                  <Unlink2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {docs.length > SHOW_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors duration-200"
            >
              {showAll ? 'Show less' : `+${docs.length - SHOW_LIMIT} more`}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No docs linked yet. Link design notes, specs, or runbooks to keep context close.
        </p>
      )}
    </div>
  );
}
