'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, User, Tag, Clock } from 'lucide-react';
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
    <div className="space-y-3">
      {/* Status */}
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Status</label>
        <div className="mt-1.5">
          <StatusPicker
            projectId={issue.projectId}
            value={issue.statusId}
            onChange={handleStatusChange}
            disabled={updateIssue.isPending}
          />
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Priority</label>
        <div className="mt-1.5">
            <PriorityPicker
              value={issue.priority}
              onChange={handlePriorityChange}
              disabled={updateIssue.isPending}
            />
          </div>
        </div>

      {/* Assignee */}
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" />
          Assignee
        </label>
        <div className="mt-1.5">
            <AssigneePicker
              organizationId={currentOrganizationId}
              value={issue.assigneeId || null}
              onChange={handleAssigneeChange}
              disabled={updateIssue.isPending}
            />
          </div>
        </div>

        {/* Reporter */}
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Reporter</label>
          <div className="mt-2 flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src="https://avatar.vercel.sh/reporter" />
              <AvatarFallback>R</AvatarFallback>
            </Avatar>
            <span className="text-sm">Reporter User</span>
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Tag className="h-3 w-3" />
            Labels
          </label>
          <div className="mt-2">
            <LabelPicker
              value={issue.labels}
              onChange={handleLabelsChange}
              disabled={updateIssue.isPending}
            />
          </div>
        </div>

        {/* Estimate */}
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Estimate
          </label>
          <div className="mt-2 text-sm">
            {issue.estimate ? `${issue.estimate} hours` : 'Not estimated'}
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Due Date
          </label>
          <div className="mt-2 text-sm">
            {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'No due date'}
          </div>
        </div>

        {/* Custom Fields */}
        <div className="border-t pt-6">
          <IssueCustomFields issueId={issue.id} />
        </div>

        {/* Watchers */}
        <div className="border-t pt-6">
          <WatchersList issueId={issue.id} />
        </div>

        {/* Metadata */}
        <div className="pt-3 border-t">
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Created</span>
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>{new Date(issue.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
  );
}
