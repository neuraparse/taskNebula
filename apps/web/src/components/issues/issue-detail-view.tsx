'use client';

import { IssueHeader } from './issue-header';
import { IssueContent } from './issue-content';
import { IssueActivity } from './issue-activity';
import { IssueSidebar } from './issue-sidebar';
import { useIssue } from '@/lib/hooks/use-issues';
import { Loader2, Activity, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div className="border-b border-border px-6 py-4 shrink-0">
        <IssueHeader issue={issue} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[1fr_320px] h-full">
          {/* Main Content Area */}
          <div className="overflow-y-auto custom-scrollbar">
            <div className="p-6 max-w-3xl">
              {/* Description */}
              <div className="card-elevated p-5 mb-6">
                <IssueContent issue={issue} />
              </div>

              {/* Activity */}
              <div className="card-elevated p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Activity</h3>
                </div>
                <IssueActivity issueId={issue.id} />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="border-l border-border overflow-y-auto custom-scrollbar bg-muted/20">
            <div className="p-5">
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
