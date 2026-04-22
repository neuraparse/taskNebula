'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { LabelPicker } from './label-picker';
import { IssueCustomFields } from '@/components/custom-fields/issue-custom-fields';
import { WatchersList } from '@/components/watchers/watchers-list';
import { AiIssueAssistPanel } from '@/components/ai/ai-issue-assist-panel';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useUpdateIssue } from '@/lib/hooks/use-issues';

interface IssueSidebarProps {
  issue: {
    id: string;
    projectId: string;
    statusId: string;
    priority: string;
    assigneeId?: string | null;
    reporterId: string;
    labels: string[];
    estimate?: number | string | null;
    dueDate?: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
  onUpdate: (issue: any) => void;
}

export function IssueSidebar({ issue }: IssueSidebarProps) {
  const { currentOrganizationId } = useOrganization();
  const updateIssue = useUpdateIssue();

  const handleAssigneeChange = async (assigneeId: string | null) => {
    try {
      await updateIssue.mutateAsync({ issueId: issue.id, data: { assigneeId } });
    } catch (error) {
      console.error('Error updating assignee:', error);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await updateIssue.mutateAsync({ issueId: issue.id, data: { priority } });
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const handleLabelsChange = async (labels: string[]) => {
    try {
      await updateIssue.mutateAsync({ issueId: issue.id, data: { labels } as any });
    } catch (error) {
      console.error('Error updating labels:', error);
    }
  };

  const handleStatusChange = async (statusId: string) => {
    try {
      await updateIssue.mutateAsync({ issueId: issue.id, data: { statusId } });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="kicker">Details</span>
        <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm items-center">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusPicker
              projectId={issue.projectId}
              value={issue.statusId}
              onChange={handleStatusChange}
              disabled={updateIssue.isPending}
            />
          </dd>

          <dt className="text-muted-foreground">Priority</dt>
          <dd>
            <PriorityPicker
              value={issue.priority}
              onChange={handlePriorityChange}
              disabled={updateIssue.isPending}
            />
          </dd>

          <dt className="text-muted-foreground">Assignee</dt>
          <dd>
            <AssigneePicker
              organizationId={currentOrganizationId}
              value={issue.assigneeId || null}
              onChange={handleAssigneeChange}
              disabled={updateIssue.isPending}
            />
          </dd>

          <dt className="text-muted-foreground">Reporter</dt>
          <dd className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src="https://avatar.vercel.sh/reporter" />
              <AvatarFallback className="text-[9px] font-medium bg-muted">R</AvatarFallback>
            </Avatar>
            <span className="text-foreground">Reporter</span>
          </dd>

          <dt className="text-muted-foreground">Estimate</dt>
          <dd className="text-foreground">
            {issue.estimate ? `${issue.estimate}h` : <span className="text-muted-foreground">None</span>}
          </dd>

          <dt className="text-muted-foreground">Due date</dt>
          <dd className="text-foreground">
            {issue.dueDate ? (
              new Date(issue.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </dd>
        </dl>
      </section>

      <section className="space-y-3">
        <span className="kicker">Labels</span>
        <LabelPicker
          value={issue.labels}
          onChange={handleLabelsChange}
          disabled={updateIssue.isPending}
        />
      </section>

      <section className="space-y-3">
        <IssueCustomFields issueId={issue.id} />
      </section>

      <section className="space-y-3">
        <WatchersList issueId={issue.id} />
      </section>

      <section className="space-y-3">
        <AiIssueAssistPanel
          issueId={issue.id}
          onApplyDescription={(text) =>
            updateIssue
              .mutateAsync({ issueId: issue.id, data: { description: text } })
              .catch(() => {})
          }
          onApplyLabels={(labels) => handleLabelsChange(labels)}
        />
      </section>

      <section className="space-y-1 pt-3 border-t border-border/60">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Created</span>
          <span>{formatDate(issue.createdAt)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Updated</span>
          <span>{formatDate(issue.updatedAt)}</span>
        </div>
      </section>
    </div>
  );
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
