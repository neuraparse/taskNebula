'use client';

import { useState } from 'react';
import {
  Boxes,
  Bug,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Gauge,
  Milestone,
  Tag,
  User,
  UserCircle2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PriorityBars, type PriorityLevel } from '@/components/ui/priority-bars';
import { AssigneePicker } from './assignee-picker';
import { PriorityPicker } from './priority-picker';
import { StatusPicker } from './status-picker';
import { LabelPicker } from './label-picker';
import { ComponentPicker } from './component-picker';
import { VersionPicker } from './version-picker';
import { ResolutionSelect, type IssueResolution } from './resolution-select';
import { IssueCustomFields } from '@/components/custom-fields/issue-custom-fields';
import { WatchersList } from '@/components/watchers/watchers-list';
import { AiIssueAssistPanel } from '@/components/ai/ai-issue-assist-panel';
import { AgentActivityPanel } from './agent-activity-panel';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationMembers } from '@/lib/hooks/use-members';
import { useIssue, useUpdateIssue, type Issue } from '@/lib/hooks/use-issues';
import { useIssueVersions, useSetIssueVersions } from '@/lib/hooks/use-issue-versions';
import { useIssueComponents, useSetIssueComponents } from '@/lib/hooks/use-issue-components';

// Reserved for future fields (not yet rendered but part of the design vocabulary):
// CalendarPlus (Start date), GitBranch (Parent), RefreshCw (Cycle / Sprint), Users (multi-assignee)

/** Fields the detail GET returns beyond the shared `Issue` hook shape. */
type IssueDetailExtras = Issue & {
  resolution?: string | null;
  resolvedAt?: string | null;
};

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
  onUpdate: (issue: unknown) => void;
}

export function IssueSidebar({ issue }: IssueSidebarProps) {
  const t = useTranslations('issueSidebar');
  const { currentOrganizationId } = useOrganization();
  const updateIssue = useUpdateIssue();
  const { data: membersData } = useOrganizationMembers(currentOrganizationId);
  // The detail query is already populated by the parent view; reading it here
  // surfaces fields the narrowed `issue` prop doesn't carry (type/resolution).
  const { data: issueDetailData } = useIssue(issue.id);
  const issueDetail = issueDetailData as IssueDetailExtras | null | undefined;

  const { data: issueVersions } = useIssueVersions(issue.id);
  const { data: issueComponents } = useIssueComponents(issue.id);
  const setIssueVersions = useSetIssueVersions();
  const setIssueComponents = useSetIssueComponents();

  const [affectsExpanded, setAffectsExpanded] = useState(false);

  const assignee = issue.assigneeId
    ? membersData?.members.find((m) => m.id === issue.assigneeId)
    : null;
  const agentAssignee = assignee && assignee.isAgent && assignee.agentProvider ? assignee : null;
  const reporter = membersData?.members.find((m) => m.id === issue.reporterId);

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
      await updateIssue.mutateAsync({ issueId: issue.id, data: { labels } });
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

  const handleResolutionChange = async (resolution: IssueResolution | null) => {
    try {
      // `resolution` is accepted by the PATCH route but isn't part of the
      // shared `Issue` hook shape yet — widen the payload type explicitly.
      const data: Partial<Issue> & { resolution: IssueResolution | null } = { resolution };
      await updateIssue.mutateAsync({ issueId: issue.id, data });
    } catch (error) {
      console.error('Error updating resolution:', error);
    }
  };

  const handleComponentsChange = (componentIds: string[]) => {
    setIssueComponents.mutate(
      { issueId: issue.id, componentIds },
      { onError: (error) => console.error('Error updating components:', error) }
    );
  };

  const handleFixVersionsChange = (fixVersionIds: string[]) => {
    setIssueVersions.mutate(
      { issueId: issue.id, fixVersionIds },
      { onError: (error) => console.error('Error updating fix versions:', error) }
    );
  };

  const handleAffectsVersionsChange = (affectsVersionIds: string[]) => {
    setIssueVersions.mutate(
      { issueId: issue.id, affectsVersionIds },
      { onError: (error) => console.error('Error updating affects versions:', error) }
    );
  };

  const priorityLevel = toPriorityLevel(issue.priority);

  const fixVersions = issueVersions?.fixVersions ?? [];
  const affectsVersions = issueVersions?.affectsVersions ?? [];
  const components = issueComponents ?? [];
  // Affects Versions is a first-class row for bugs; for other issue types it
  // stays collapsed behind a disclosure unless something is already linked.
  const isBug = issueDetail?.type === 'bug';
  const showAffectsRow = isBug || affectsVersions.length > 0 || affectsExpanded;

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
              organizationId={currentOrganizationId}
              projectId={issue.projectId}
            />
          </PropertyRow>
        </div>

        {/* Group 2: Delivery — components, versions, resolution */}
        <div className="border-border/50 mt-3 border-t pt-3">
          <PropertyRow icon={<Boxes className="h-3.5 w-3.5" />} label={t('components.label')}>
            <ComponentPicker
              projectId={issue.projectId}
              value={components}
              onChange={handleComponentsChange}
              disabled={setIssueComponents.isPending}
            />
          </PropertyRow>

          <PropertyRow icon={<Milestone className="h-3.5 w-3.5" />} label={t('versions.fixLabel')}>
            <VersionPicker
              projectId={issue.projectId}
              value={fixVersions}
              onChange={handleFixVersionsChange}
              disabled={setIssueVersions.isPending}
            />
          </PropertyRow>

          {showAffectsRow ? (
            <PropertyRow icon={<Bug className="h-3.5 w-3.5" />} label={t('versions.affectsLabel')}>
              <VersionPicker
                projectId={issue.projectId}
                value={affectsVersions}
                onChange={handleAffectsVersionsChange}
                disabled={setIssueVersions.isPending}
              />
            </PropertyRow>
          ) : (
            <button
              type="button"
              onClick={() => setAffectsExpanded(true)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1.5 text-[12px] transition-colors duration-150"
            >
              <ChevronRight className="h-3 w-3" />
              {t('versions.showAffects')}
            </button>
          )}

          <PropertyRow
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label={t('resolution.label')}
          >
            <ResolutionSelect
              value={issueDetail?.resolution ?? null}
              resolvedAt={issueDetail?.resolvedAt ?? null}
              onChange={handleResolutionChange}
              disabled={updateIssue.isPending}
            />
          </PropertyRow>
        </div>

        {/* Group 3: People */}
        <div className="border-border/50 mt-3 border-t pt-3">
          <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Assignee">
            <AssigneePicker
              organizationId={currentOrganizationId}
              value={issue.assigneeId || null}
              onChange={handleAssigneeChange}
              disabled={updateIssue.isPending}
            />
          </PropertyRow>

          <PropertyRow icon={<UserCircle2 className="h-3.5 w-3.5" />} label={t('reporter.label')}>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={reporter?.image || undefined}
                  alt={reporter?.name ?? reporter?.email ?? 'Reporter avatar'}
                />
                <AvatarFallback className="bg-muted text-[9px] font-medium">
                  {(reporter?.name?.[0] || reporter?.email?.[0] || '?').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={reporter ? 'text-foreground truncate' : 'text-muted-foreground'}>
                {reporter?.name || reporter?.email || t('reporter.unknown')}
              </span>
            </div>
          </PropertyRow>
        </div>

        {/* Group 4: Dates & Hierarchy */}
        <div className="border-border/50 mt-3 border-t pt-3">
          <PropertyRow icon={<CalendarClock className="h-3.5 w-3.5" />} label="Due date">
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

          <PropertyRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created on">
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

      {agentAssignee ? (
        <AgentActivityPanel
          issueId={issue.id}
          agentProvider={agentAssignee.agentProvider!}
          assigneeName={agentAssignee.name}
        />
      ) : null}

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

      <section className="border-border/60 space-y-1 border-t pt-3">
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>Created</span>
          <span>{formatDate(issue.createdAt)}</span>
        </div>
        <div className="text-muted-foreground flex justify-between text-xs">
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
      <div className="text-muted-foreground flex w-24 shrink-0 items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
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
