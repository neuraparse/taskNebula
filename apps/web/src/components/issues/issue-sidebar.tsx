'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, User, Tag, Clock, AlertCircle } from 'lucide-react';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { LabelPicker } from './label-picker';
import { IssueCustomFields } from '@/components/custom-fields/issue-custom-fields';
import { WatchersList } from '@/components/watchers/watchers-list';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useUpdateIssue } from '@/lib/hooks/use-issues';
import { cn } from '@/lib/utils';

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
      await updateIssue.mutateAsync({
        issueId: issue.id,
        data: { assigneeId },
      });
    } catch (error) {
      console.error('Error updating assignee:', error);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await updateIssue.mutateAsync({
        issueId: issue.id,
        data: { priority },
      });
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const handleLabelsChange = async (labels: string[]) => {
    try {
      await updateIssue.mutateAsync({
        issueId: issue.id,
        data: { labels } as any,
      });
    } catch (error) {
      console.error('Error updating labels:', error);
    }
  };

  const handleStatusChange = async (statusId: string) => {
    try {
      await updateIssue.mutateAsync({
        issueId: issue.id,
        data: { statusId },
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <div className="space-y-5">
      {/* Status */}
      <SidebarSection title="Status">
        <StatusPicker
          projectId={issue.projectId}
          value={issue.statusId}
          onChange={handleStatusChange}
          disabled={updateIssue.isPending}
        />
      </SidebarSection>

      {/* Priority */}
      <SidebarSection title="Priority" icon={AlertCircle}>
        <PriorityPicker
          value={issue.priority}
          onChange={handlePriorityChange}
          disabled={updateIssue.isPending}
        />
      </SidebarSection>

      {/* Assignee */}
      <SidebarSection title="Assignee" icon={User}>
        <AssigneePicker
          organizationId={currentOrganizationId}
          value={issue.assigneeId || null}
          onChange={handleAssigneeChange}
          disabled={updateIssue.isPending}
        />
      </SidebarSection>

      {/* Reporter */}
      <SidebarSection title="Reporter">
        <div className="flex items-center gap-2.5 py-1">
          <Avatar className="h-6 w-6">
            <AvatarImage src="https://avatar.vercel.sh/reporter" />
            <AvatarFallback className="text-[10px] font-medium bg-muted">R</AvatarFallback>
          </Avatar>
          <span className="text-sm">Reporter User</span>
        </div>
      </SidebarSection>

      {/* Labels */}
      <SidebarSection title="Labels" icon={Tag}>
        <LabelPicker
          value={issue.labels}
          onChange={handleLabelsChange}
          disabled={updateIssue.isPending}
        />
      </SidebarSection>

      {/* Estimate */}
      <SidebarSection title="Estimate" icon={Clock}>
        <p className="text-sm py-1">
          {issue.estimate ? (
            <span className="font-medium">{issue.estimate} hours</span>
          ) : (
            <span className="text-muted-foreground">Not estimated</span>
          )}
        </p>
      </SidebarSection>

      {/* Due Date */}
      <SidebarSection title="Due Date" icon={Calendar}>
        <p className="text-sm py-1">
          {issue.dueDate ? (
            <span className="font-medium">
              {new Date(issue.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          ) : (
            <span className="text-muted-foreground">No due date</span>
          )}
        </p>
      </SidebarSection>

      {/* Custom Fields */}
      <div className="pt-4 border-t border-border">
        <IssueCustomFields issueId={issue.id} />
      </div>

      {/* Watchers */}
      <div className="pt-4 border-t border-border">
        <WatchersList issueId={issue.id} />
      </div>

      {/* Metadata */}
      <div className="pt-4 border-t border-border">
        <div className="space-y-2">
          <MetadataRow label="Created" value={formatDate(issue.createdAt)} />
          <MetadataRow label="Updated" value={formatDate(issue.updatedAt)} />
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground tracking-wider mb-2">
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </label>
      {children}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
