'use client';

import { useState, type ElementType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { IssueHeader } from './issue-header';
import { IssueContent } from './issue-content';
import { IssueActivity } from './issue-activity';
import { IssueSidebar } from './issue-sidebar';
import { IssueQuickActions } from './issue-quick-actions';
import { IssueTriagePanel } from './issue-triage-panel';
import { TimeInStatusPanel } from './time-in-status-panel';
import { TimeTrackingPanel } from './time-tracking-panel';
import { useIssue, useDeleteIssue, type Issue } from '@/lib/hooks/use-issues';
import { useAiCapability } from '@/lib/hooks/use-ai-capability';
import { useToast } from '@/hooks/use-toast';
import { isApiPermissionError } from '@/lib/client-api-errors';
import { FileText, AlertCircle, ChevronDown, Clock, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ViewTransition } from '@/components/ui/view-transition';
import { cn } from '@/lib/utils';

/** Fields the GET /api/issues/[issueId] payload carries beyond the shared
 *  `Issue` client type (Drizzle `numeric` columns serialize as strings). */
type IssueDetailExtras = Issue & {
  estimateHours?: string | number | null;
  actualHours?: string | number | null;
  estimateSource?: string | null;
};

function toHours(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Sidebar-column section with a toggleable header, styled to match the
 *  existing TimeInStatusPanel header treatment. */
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  icon: ElementType;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-muted-foreground ease-snap hover:text-foreground flex w-full items-center gap-2 text-xs font-medium transition-colors duration-150"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn(
            'ease-snap h-3.5 w-3.5 transition-transform duration-150',
            !open && '-rotate-90'
          )}
        />
      </button>
      {open && <div className="pt-2.5">{children}</div>}
    </section>
  );
}

export function IssueDetailView({
  issueId,
  onClose,
}: {
  issueId: string;
  /** When the view lives in a modal, called after destructive actions so the
   *  host can dismiss instead of navigating away. */
  onClose?: () => void;
}) {
  const t = useTranslations('issueDetail');
  const tHome = useTranslations('pagesHome');
  const { data: issue, isLoading, error, refetch } = useIssue(issueId);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const deleteIssue = useDeleteIssue();
  const { canRunAgents } = useAiCapability();

  const handleIssueUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['issues'] });
    queryClient.invalidateQueries({ queryKey: ['my-issues'] });
    queryClient.invalidateQueries({ queryKey: ['your-work'] });
    queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
  };

  const handleDelete = () => {
    if (typeof window !== 'undefined' && !window.confirm(t('quickActions.deleteConfirm'))) {
      return;
    }
    deleteIssue.mutate(issueId, {
      onSuccess: () => {
        if (onClose) {
          onClose();
        } else {
          router.push('/issues');
        }
      },
      onError: () => {
        toast({ title: t('quickActions.deleteFailed'), variant: 'destructive' });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
        {/* Header skeleton */}
        <div className="border-border bg-background shrink-0 border-b px-6 py-4">
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
            <div className="custom-scrollbar overflow-y-auto">
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
            <div className="border-border custom-scrollbar hidden overflow-y-auto border-l lg:block">
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
    const errorMessage = isApiPermissionError(error)
      ? tHome('toast_access_denied_description')
      : t('view.loadFailedHint');
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="animate-fade-up max-w-sm px-4 text-center">
          <div className="bg-destructive/10 mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md">
            <AlertCircle className="text-destructive h-5 w-5" />
          </div>
          <p className="text-foreground font-medium">{t('view.loadFailed')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="animate-fade-up max-w-sm px-4 text-center">
          <div className="bg-muted mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md">
            <FileText className="text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-foreground font-medium">{t('view.notFound')}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t('view.notFoundHint')}</p>
        </div>
      </div>
    );
  }

  const extras = issue as IssueDetailExtras;

  return (
    <div className="bg-background animate-fade-up flex h-full min-h-0 flex-col overflow-hidden">
      {/* FEAT-31: morph target — pairs with `issue-${id}` on the source card
          (kanban / dashboard list) so navigation feels continuous. */}
      <ViewTransition name={`issue-${issue.id}`}>
        <div
          className={cn(
            'border-border bg-background shrink-0 border-b px-6 py-4',
            // In modal mode the Dialog's absolute close (X) sits at top-right;
            // pad the header so the title row / action buttons never slip
            // underneath it. Full-page view (no onClose) keeps the normal inset.
            onClose && 'pr-14'
          )}
        >
          <IssueHeader issue={issue} />
          {/* Jira-style quick-action row under the title. Duplicate/Archive
              callbacks are intentionally not passed — no backend yet. */}
          <div className="mt-3">
            <IssueQuickActions
              issueId={issue.id}
              issueKey={issue.key}
              title={issue.title}
              flagged={issue.flagged ?? false}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </ViewTransition>

      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="custom-scrollbar overflow-y-auto">
            <div className="space-y-8 px-5 py-6 lg:px-8">
              <IssueContent issue={issue} />
              <IssueActivity issueId={issue.id} />
            </div>
          </div>

          <div className="border-border custom-scrollbar overflow-y-auto border-l">
            <div className="px-5 py-5">
              {canRunAgents && (
                <CollapsibleSection
                  title={t('sections.triage')}
                  icon={Sparkles}
                  defaultOpen={false}
                  className="border-border/60 mb-4 border-b pb-3"
                >
                  <IssueTriagePanel issueId={issue.id} />
                </CollapsibleSection>
              )}
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
              <CollapsibleSection
                title={t('sections.timeTracking')}
                icon={Clock}
                defaultOpen
                className="border-border/60 mt-4 border-t pb-3 pt-3"
              >
                <TimeTrackingPanel
                  key={issue.id}
                  issueId={issue.id}
                  initialEstimateHours={toHours(extras.estimateHours)}
                  initialActualHours={toHours(extras.actualHours)}
                  initialEstimateSource={extras.estimateSource ?? null}
                />
              </CollapsibleSection>
              <TimeInStatusPanel issueId={issue.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
