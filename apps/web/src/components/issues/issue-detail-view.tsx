'use client';

import { IssueHeader } from './issue-header';
import { IssueContent } from './issue-content';
import { IssueActivity } from './issue-activity';
import { IssueSidebar } from './issue-sidebar';
import { useIssue } from '@/lib/hooks/use-issues';
import { Loader2, FileText, AlertCircle } from 'lucide-react';

export function IssueDetailView({ issueId }: { issueId: string }) {
  const { data: issue, isLoading, error } = useIssue(issueId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading issue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center max-w-sm px-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <p className="font-medium text-foreground">Failed to load issue</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center max-w-sm px-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">Issue not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            The issue you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/60 bg-background/95 px-6 py-3">
        <IssueHeader issue={issue} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-[1fr_340px]">
          {/* Main Content Area */}
          <div className="overflow-y-auto custom-scrollbar">
            <div className="space-y-8 px-8 py-6">
              <IssueContent issue={issue} />
              <IssueActivity issueId={issue.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="overflow-y-auto border-l border-border/60 bg-muted/[0.04] custom-scrollbar">
            <div className="px-5 py-5">
              <IssueSidebar
                issue={{
                  id: issue.id,
                  projectId: issue.projectId,
                  statusId: issue.statusId ?? issue.status,
                  priority: issue.priority,
                  assigneeId: issue.assigneeId,
                  reporterId: issue.reporterId,
                  labels: Array.isArray(issue.labels) ? issue.labels : [],
                  estimate: issue.estimate,
                  dueDate: issue.dueDate,
                  createdAt: issue.createdAt,
                  updatedAt: issue.updatedAt,
                }}
                onUpdate={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
