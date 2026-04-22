'use client';

import {
  Calendar,
  CalendarClock,
  CircleDot,
  Gauge,
  Tag,
  User,
  UserCircle2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PriorityBars, type PriorityLevel } from '@/components/ui/priority-bars';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { LabelPicker } from './label-picker';
import { IssueCustomFields } from '@/components/custom-fields/issue-custom-fields';
import { WatchersList } from '@/components/watchers/watchers-list';
import { AiIssueAssistPanel } from '@/components/ai/ai-issue-assist-panel';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useUpdateIssue } from '@/lib/hooks/use-issues';

// Reserved for future fields (not yet rendered but part of the design vocabulary):
// CalendarPlus (Start date), GitBranch (Parent), RefreshCw (Cycle / Sprint), Users (multi-assignee)

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

  const priorityLevel = toPriorityLevel(issue.priority);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <span className="kicker">Details</span>

        {/* Group 1: Status & Priority */}
        <div>
          <PropertyRow icon={<CircleDot className="h-3.5 w-3.5" />} label="State">
            <StatusPicker
              projectId={issue.projectId}
              value={issue.statusId}
              onChange={handleStatusChange}
              disabled={updateIssue.isPending}
            />
          </PropertyRow>

          <PropertyRow
            icon={<PriorityBars level={priorityLevel} size={14} className="shrink-0" />}
            label="Priority"
          >
            <PriorityPicker
              value={issue.priority}
              onChange={handlePriorityChange}
              disabled={updateIssue.isPending}
            />
          </PropertyRow>

          <PropertyRow icon={<Tag className="h-3.5 w-3.5" />} label="Labels">
            <LabelPicker
              value={issue.labels}
              onChange={handleLabelsChange}
              disabled={updateIssue.isPending}
            />
          </PropertyRow>
        </div>

        {/* Group 2: People */}
        <div className="border-t border-border/50 mt-3 pt-3">
          <PropertyRow
            icon={<User className="h-3.5 w-3.5" />}
            label="Assignee"
          >
            <AssigneePicker
              organizationId={currentOrganizationId}
              value={issue.assigneeId || null}
              onChange={handleAssigneeChange}
              disabled={updateIssue.isPending}
            />
          </PropertyRow>

          <PropertyRow
            icon={<UserCircle2 className="h-3.5 w-3.5" />}
            label="Reporter"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src="https://avatar.vercel.sh/reporter" />
                <AvatarFallback className="text-[9px] font-medium bg-muted">R</AvatarFallback>
              </Avatar>
              <span className="text-foreground">Reporter</span>
            </div>
          </PropertyRow>
        </div>

        {/* Group 3: Dates & Hierarchy */}
        <div className="border-t border-border/50 mt-3 pt-3">
          <PropertyRow
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Due date"
          >
            <span className="text-foreground">
              {issue.dueDate ? (
                new Date(issue.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </span>
          </PropertyRow>

          <PropertyRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Created on"
          >
            <span className="text-foreground">{formatDate(issue.createdAt)}</span>
          </PropertyRow>

          <PropertyRow icon={<Gauge className="h-3.5 w-3.5" />} label="Estimate">
            <span className="text-foreground">
              {issue.estimate ? (
                `${issue.estimate}h`
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </span>
          </PropertyRow>
        </div>
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

interface PropertyRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function PropertyRow({ icon, label, children }: PropertyRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-[12.5px]">
      <div className="flex items-center gap-2 w-24 text-muted-foreground shrink-0">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const PRIORITY_LEVELS: ReadonlyArray<PriorityLevel> = ['urgent', 'high', 'medium', 'low', 'none'];

function toPriorityLevel(value: string): PriorityLevel {
  const normalized = value?.toLowerCase?.() ?? '';
  return (PRIORITY_LEVELS as ReadonlyArray<string>).includes(normalized)
    ? (normalized as PriorityLevel)
    : 'none';
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
