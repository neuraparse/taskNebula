'use client';

import { IssueHeader } from './issue-header';
import { IssueContent } from './issue-content';
import { IssueActivity } from './issue-activity';
import { IssueSidebar } from './issue-sidebar';
import { useIssue } from '@/lib/hooks/use-issues';
import { ExecutionLogsViewer } from '@/components/agents/execution-logs-viewer';
import { useAgentExecutions } from '@/lib/hooks/use-agent-execution';
import { Loader2, Bot, Activity, FileText, AlertCircle, Lock, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export function IssueDetailView({ issueId }: { issueId: string }) {
  const { data: issue, isLoading, error } = useIssue(issueId);
  const { data: executions } = useAgentExecutions(issueId);

  const activeExecution = executions?.find((e: any) =>
    ['queued', 'setup_pending', 'setup_in_progress', 'executing', 'committing', 'pushing'].includes(e.status)
  );
  const latestExecution = executions?.[0];

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

              {/* Tabs */}
              <Tabs defaultValue={activeExecution ? 'agent' : 'activity'} className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-10 p-1 bg-muted/50 rounded-lg">
                  <TabsTrigger
                    value="activity"
                    className={cn(
                      'gap-2 rounded-md text-sm font-medium transition-all',
                      'data-[state=active]:bg-background data-[state=active]:shadow-sm'
                    )}
                  >
                    <Activity className="h-4 w-4" />
                    Activity
                  </TabsTrigger>
                  <TabsTrigger
                    value="agent"
                    className={cn(
                      'gap-2 rounded-md text-sm font-medium transition-all relative',
                      'data-[state=active]:bg-background data-[state=active]:shadow-sm'
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    AI Agent
                    <span className="text-[9px] px-1 py-0 rounded font-semibold border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                      Enterprise
                    </span>
                    {activeExecution && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-4">
                  <div className="card-elevated p-5">
                    <IssueActivity issueId={issue.id} />
                  </div>
                </TabsContent>

                <TabsContent value="agent" className="mt-4">
                  <div className="card-elevated p-5">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
                        <Lock className="h-7 w-7 text-amber-500" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-foreground">Agent Executions</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                          Enterprise
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-[300px] mb-5">
                        AI agents can write code, create branches, and submit PRs automatically. Available on Enterprise plans.
                      </p>
                      <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors">
                        <Sparkles className="h-4 w-4" />
                        Upgrade to Enterprise
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
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
