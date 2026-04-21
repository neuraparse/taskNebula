'use client';

import { useState } from 'react';
import { useIssueLinks, useDeleteIssueLink, getLinkTypeLabel } from '@/lib/hooks/use-issue-links';
import { LinkIssueDialog } from './link-issue-dialog';
import { Button } from '@/components/ui/button';
import { Link2, Plus, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface IssueLinksProps {
  issueId: string;
  projectId: string;
}

export function IssueLinks({ issueId, projectId }: IssueLinksProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: linksData, isLoading } = useIssueLinks(issueId);
  const deleteLink = useDeleteIssueLink();

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteLink.mutateAsync({ issueId, linkId });
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        Loading...
      </div>
    );
  }

  const allLinks = [...(linksData?.outbound || []), ...(linksData?.inbound || [])];

  return (
    <>
      <div className="space-y-2 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            {allLinks.length > 0 && (
              <span className="chip text-[11px]">{allLinks.length}</span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDialogOpen(true)} aria-label="Add link">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {allLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">
            No linked issues.{' '}
            <button
              onClick={() => setDialogOpen(true)}
              className="text-primary hover:underline transition-colors duration-200"
            >
              Add a link
            </button>
          </p>
        ) : (
          <div className="space-y-1">
            {allLinks.map((link) => (
              <div
                key={link.id}
                className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors duration-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {getLinkTypeLabel(link.type, link.direction)}
                  </span>
                  <Link
                    href={`/issues/${link.issue.id}`}
                    className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors duration-200 min-w-0"
                  >
                    <span className="chip font-mono text-[11px] shrink-0">{link.issue.key}</span>
                    <span className="truncate">{link.issue.title}</span>
                    <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                  </Link>
                  <span className={`chip shrink-0 text-[11px] ${
                    link.issue.priority === 'critical' ? 'bg-accent-rose/10 text-accent-rose border-accent-rose/20' :
                    link.issue.priority === 'high' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/20' : ''
                  }`}>
                    {link.issue.priority}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  onClick={() => handleDeleteLink(link.id)}
                  disabled={deleteLink.isPending}
                  aria-label="Remove link"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <LinkIssueDialog
        issueId={issueId}
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

