'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { LabelPicker } from './label-picker';
import { IssueCustomFields } from '@/components/custom-fields/issue-custom-fields';
import { WatchersList } from '@/components/watchers/watchers-list';
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
    <div className="space-y-1">
      <PropertyRow label="Status">
        <StatusPicker
          projectId={issue.projectId}
          value={issue.statusId}
          onChange={handleStatusChange}
          disabled={updateIssue.isPending}
        />
      </PropertyRow>

      <PropertyRow label="Priority">
        <PriorityPicker
          value={issue.priority}
          onChange={handlePriorityChange}
          disabled={updateIssue.isPending}
        />
      </PropertyRow>

      <PropertyRow label="Assignee">
        <AssigneePicker
          organizationId={currentOrganizationId}
          value={issue.assigneeId || null}
          onChange={handleAssigneeChange}
          disabled={updateIssue.isPending}
        />
      </PropertyRow>

      <PropertyRow label="Reporter">
        <div className="flex items-center gap-2 py-0.5">
          <Avatar className="h-5 w-5">
            <AvatarImage src="https://avatar.vercel.sh/reporter" />
            <AvatarFallback className="text-[9px] font-medium bg-muted">R</AvatarFallback>
          </Avatar>
          <span className="text-sm">Reporter</span>
        </div>
      </PropertyRow>

      <PropertyRow label="Labels">
        <LabelPicker
          value={issue.labels}
          onChange={handleLabelsChange}
          disabled={updateIssue.isPending}
        />
      </PropertyRow>

      <PropertyRow label="Estimate">
        <span className="text-sm">
          {issue.estimate ? `${issue.estimate}h` : <span className="text-muted-foreground/50">None</span>}
        </span>
      </PropertyRow>

      <PropertyRow label="Due date">
        <span className="text-sm">
          {issue.dueDate ? (
            new Date(issue.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          ) : (
            <span className="text-muted-foreground/50">None</span>
          )}
        </span>
      </PropertyRow>

      {/* Custom Fields */}
      <div className="pt-4 mt-4">
        <IssueCustomFields issueId={issue.id} />
      </div>

      {/* Watchers */}
      <div className="pt-4">
        <WatchersList issueId={issue.id} />
      </div>

      {/* Metadata */}
      <div className="pt-4 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground/60">Created</span>
          <span className="text-muted-foreground">{formatDate(issue.createdAt)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground/60">Updated</span>
          <span className="text-muted-foreground">{formatDate(issue.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2 min-h-[38px]">
      <span className="text-xs text-muted-foreground shrink-0 w-[80px]">{label}</span>
      <div className="flex-1">{children}</div>
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
