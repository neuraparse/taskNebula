'use client';

import { IssueHeader } from './issue-header';
import { IssueContent } from './issue-content';
import { IssueActivity } from './issue-activity';
import { IssueSidebar } from './issue-sidebar';
import { useIssue } from '@/lib/hooks/use-issues';
import { FileText, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function IssueDetailView({ issueId }: { issueId: string }) {
  const { data: issue, isLoading, error, refetch } = useIssue(issueId);
  const queryClient = useQueryClient();

  const handleIssueUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['issues'] });
    queryClient.invalidateQueries({ queryKey: ['my-issues'] });
    queryClient.invalidateQueries({ queryKey: ['your-work'] });
    queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        {/* Header skeleton */}
        <div className="shrink-0 border-b border-border bg-background px-6 py-4">
          <div className="space-y-2">
            <div className="shimmer h-3 w-24 rounded-sm" />
            <div className="shimmer h-6 w-2/3 rounded-md" />
            <div className="flex items-center gap-2 pt-1">
              <div className="shimmer h-5 w-16 rounded-sm" />
              <div className="shimmer h-5 w-20 rounded-sm" />
              <div className="shimmer h-5 w-14 rounded-sm" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
            {/* Main content skeleton */}
            <div className="overflow-y-auto custom-scrollbar">
              <div className="space-y-6 px-5 py-6 lg:px-8">
                <div className="space-y-3">
                  <div className="shimmer h-4 w-full rounded-sm" />
                  <div className="shimmer h-4 w-11/12 rounded-sm" />
                  <div className="shimmer h-4 w-4/5 rounded-sm" />
                  <div className="shimmer h-4 w-3/4 rounded-sm" />
                </div>
                <div className="space-y-3">
                  <div className="shimmer h-4 w-5/6 rounded-sm" />
                  <div className="shimmer h-4 w-2/3 rounded-sm" />
                </div>
                <div className="space-y-2 pt-4">
                  <div className="shimmer h-3 w-20 rounded-sm" />
                  <div className="shimmer h-16 w-full rounded-md" />
                  <div className="shimmer h-16 w-full rounded-md" />
                </div>
              </div>
            </div>

            {/* Sidebar skeleton */}
            <div className="hidden overflow-y-auto border-l border-border custom-scrollbar lg:block">
              <div className="space-y-5 px-5 py-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="shimmer h-3 w-16 rounded-sm" />
                    <div className="shimmer h-8 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center max-w-sm px-4 animate-fade-up">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10">
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
        <div className="text-center max-w-sm px-4 animate-fade-up">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-muted">
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background animate-fade-up">
      <div className="shrink-0 border-b border-border bg-background px-6 py-4">
        <IssueHeader issue={issue} />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="overflow-y-auto custom-scrollbar">
            <div className="space-y-8 px-5 py-6 lg:px-8">
              <IssueContent issue={issue} />
              <IssueActivity issueId={issue.id} />
            </div>
          </div>

          <div className="overflow-y-auto border-l border-border custom-scrollbar">
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
                onUpdate={handleIssueUpdate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
