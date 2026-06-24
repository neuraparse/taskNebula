'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/hooks/use-organization';
import {
  useAttachIssueDoc,
  useDetachIssueDoc,
  useDocumentSearch,
  useIssueDocs,
} from '@/lib/hooks/use-docs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createDocumentAppHref } from '@/lib/docs/content';
import { useToast } from '@/hooks/use-toast';
import { isApiPermissionError } from '@/lib/client-api-errors';
import { DocumentIcon } from '@/components/docs/document-icon';
import { Loader2, Link2, Plus, Unlink2, ExternalLink } from 'lucide-react';

interface IssueDocsProps {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectId: string;
}

export function IssueDocs({ issueId, issueKey, projectId }: IssueDocsProps) {
  const t = useTranslations('issuePanels');
  const tHome = useTranslations('pagesHome');
  const formatter = useFormatter();
  const router = useRouter();
  const { toast } = useToast();
  const { currentOrganizationId } = useOrganization();
  const [search, setSearch] = useState('');
  const { data: docs, isLoading, error } = useIssueDocs(issueId);
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

  function formatDocsError(errorValue: unknown, fallback: string) {
    if (isApiPermissionError(errorValue)) {
      return tHome('toast_access_denied_description');
    }
    return errorValue instanceof Error ? errorValue.message : fallback;
  }

  async function handleCreateSpecDoc() {
    try {
      const result = await attachDoc.mutateAsync({ createNew: true, title: `${issueKey} Spec` });
      const createdPage = result?.page;

      toast({
        title: t('docs.spec_created_title'),
        description: createdPage
          ? t('docs.spec_created_named', { title: createdPage.title, issueKey })
          : t('docs.spec_created_generic', { issueKey }),
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
        title: t('docs.spec_create_failed'),
        description: formatDocsError(error, t('docs.something_went_wrong')),
        variant: 'destructive',
      });
    }
  }

  async function handleAttachExisting(pageId: string, title: string) {
    try {
      await attachDoc.mutateAsync({ pageId });
      setSearch('');
      toast({
        title: t('docs.linked_title'),
        description: t('docs.linked_description', { title, issueKey }),
      });
    } catch (error) {
      toast({
        title: t('docs.link_failed'),
        description: formatDocsError(error, t('docs.something_went_wrong')),
        variant: 'destructive',
      });
    }
  }

  async function handleDetach(pageId: string, title: string) {
    try {
      await detachDoc.mutateAsync(pageId);
      toast({
        title: t('docs.unlinked_title'),
        description: t('docs.unlinked_description', { title, issueKey }),
      });
    } catch (error) {
      toast({
        title: t('docs.unlink_failed'),
        description: formatDocsError(error, t('docs.something_went_wrong')),
        variant: 'destructive',
      });
    }
  }

  const visibleDocs = showAll ? docs || [] : (docs || []).slice(0, SHOW_LIMIT);

  return (
    <div className="animate-fade-up space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs transition-colors duration-200"
          onClick={() => void handleCreateSpecDoc()}
          disabled={attachDoc.isPending}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('docs.create_spec')}
        </Button>
      </div>

      {/* Search to attach existing */}
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('docs.search_placeholder')}
        className="h-8 text-sm"
      />
      {search.trim().length > 1 && (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {availableResults.length > 0 ? (
            availableResults.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="row-interactive flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left"
                onClick={() => void handleAttachExisting(doc.id, doc.title)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <DocumentIcon icon={doc.icon} className="h-7 w-7 shrink-0 rounded-md text-sm" />
                  <span className="truncate text-sm font-medium">{doc.title}</span>
                </div>
                <Link2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              </button>
            ))
          ) : (
            <p className="text-muted-foreground px-2 py-3 text-sm">{t('docs.no_matches')}</p>
          )}
        </div>
      )}

      {/* Linked docs list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : docs && docs.length > 0 ? (
        <div className="space-y-1">
          {visibleDocs.map((doc) => (
            <div
              key={doc.id}
              className="row-interactive group flex min-w-0 items-start justify-between gap-2 rounded-md px-2 py-1.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <DocumentIcon icon={doc.icon} className="h-7 w-7 shrink-0 rounded-md text-sm" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={createDocumentAppHref({
                      id: doc.id,
                      spaceId: doc.spaceId,
                      projectId: doc.projectId,
                    })}
                    className="hover:text-primary block truncate text-sm font-medium transition-colors duration-200"
                  >
                    {doc.title}
                  </Link>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {doc.projectId ? t('docs.kind_project') : t('docs.kind_wiki')}
                    {' · '}
                    {t('docs.updated', {
                      date: formatter.dateTime(new Date(doc.updatedAt), { dateStyle: 'medium' }),
                    })}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
                <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                  <Link
                    href={createDocumentAppHref({
                      id: doc.id,
                      spaceId: doc.spaceId,
                      projectId: doc.projectId,
                    })}
                    aria-label={t('docs.open_doc')}
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
                  aria-label={t('docs.unlink_doc')}
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
              className="text-muted-foreground hover:text-foreground w-full py-1 text-xs transition-colors duration-200"
            >
              {showAll
                ? t('docs.show_less')
                : t('docs.show_more', { count: docs.length - SHOW_LIMIT })}
            </button>
          )}
        </div>
      ) : error ? (
        <p role="alert" className="text-destructive text-sm">
          {formatDocsError(error, t('docs.something_went_wrong'))}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t('docs.empty')}</p>
      )}
    </div>
  );
}
