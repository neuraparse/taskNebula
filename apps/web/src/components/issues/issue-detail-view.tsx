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
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
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
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
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
      <div className="border-b border-border/60 px-6 py-3 shrink-0">
        <IssueHeader issue={issue} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[1fr_340px] h-full">
          {/* Main Content Area */}
          <div className="overflow-y-auto custom-scrollbar">
            <div className="px-8 py-6 space-y-8">
              <IssueContent issue={issue} />
              <IssueActivity issueId={issue.id} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="border-l border-border/60 overflow-y-auto custom-scrollbar bg-muted/10">
            <div className="px-5 py-5">
              <IssueSidebar
                issue={{
                  ...issue,
                  labels: Array.isArray(issue.labels) ? issue.labels : [],
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
