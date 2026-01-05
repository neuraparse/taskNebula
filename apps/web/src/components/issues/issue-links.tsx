'use client';

import { useState } from 'react';
import { useIssueLinks, useDeleteIssueLink, getLinkTypeLabel } from '@/lib/hooks/use-issue-links';
import { LinkIssueDialog } from './link-issue-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Links
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const allLinks = [...(linksData?.outbound || []), ...(linksData?.inbound || [])];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              Links
              {allLinks.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {allLinks.length}
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allLinks.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No linked issues.{' '}
              <button
                onClick={() => setDialogOpen(true)}
                className="text-primary hover:underline"
              >
                Add a link
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {allLinks.map((link) => (
                <div
                  key={link.id}
                  className="group flex items-start justify-between gap-2 rounded-md border p-2 hover:bg-accent"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {getLinkTypeLabel(link.type, link.direction)}
                      </span>
                    </div>
                    <Link
                      href={`/issues/${link.issue.id}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                    >
                      <Badge variant="outline" className="font-mono text-xs">
                        {link.issue.key}
                      </Badge>
                      <span className="line-clamp-1">{link.issue.title}</span>
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {link.issue.type}
                      </Badge>
                      <Badge
                        variant={
                          link.issue.priority === 'critical' || link.issue.priority === 'high'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {link.issue.priority}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeleteLink(link.id)}
                    disabled={deleteLink.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LinkIssueDialog
        issueId={issueId}
        projectId={projectId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

