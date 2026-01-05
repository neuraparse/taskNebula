'use client';

import { IssueHeader } from './issue-header';
import { IssueContent } from './issue-content';
import { IssueActivity } from './issue-activity';
import { IssueSidebar } from './issue-sidebar';
import { useIssue } from '@/lib/hooks/use-issues';
import { Loader2 } from 'lucide-react';

export function IssueDetailView({ issueId }: { issueId: string }) {
  const { data: issue, isLoading, error } = useIssue(issueId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading issue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">Failed to load issue</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Issue not found</p>
          <p className="text-sm text-muted-foreground">The issue you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header - Fixed */}
      <div className="border-b px-6 py-3 shrink-0 bg-muted/30">
        <IssueHeader issue={issue} />
      </div>

      {/* Content Area - Single Scroll */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-[1fr_280px] gap-0">
          {/* Main Content */}
          <div className="space-y-4 p-6 border-r">
            {/* Issue Content */}
            <IssueContent issue={issue} />

            {/* Activity */}
            <IssueActivity issueId={issue.id} />
          </div>

          {/* Sidebar - Sticky */}
          <div className="p-4 bg-muted/20">
            <div className="sticky top-4">
              <IssueSidebar
                issue={{
                  ...issue,
                  labels: Array.isArray(issue.labels) ? issue.labels : [],
                }}
                onUpdate={() => {
                  // Refetch issue after update
                  // This will be handled by React Query automatically
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

