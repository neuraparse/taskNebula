'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  GitBranch,
  Users,
  Settings,
  Webhook,
  Key,
  AlertCircle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLogViewerProps {
  organizationId: string;
  resourceType?: string;
  resourceId?: string;
  projectId?: string;
  issueId?: string;
  limit?: number;
}

type FilterKey = 'all' | 'created' | 'updated' | 'deleted';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
  { key: 'deleted', label: 'Deleted' },
];

// Severity -> 2px left border token. Info is the default; trace is neutral.
function severityBorder(action: string) {
  if (action.includes('deleted') || action.includes('revoked')) return 'border-l-accent-rose';
  if (action.includes('updated') || action.includes('changed')) return 'border-l-accent-amber';
  if (action.includes('created')) return 'border-l-accent-blue';
  return 'border-l-border';
}

export function AuditLogViewer({
  organizationId,
  resourceType,
  resourceId,
  projectId,
  issueId,
  limit = 50,
}: AuditLogViewerProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', organizationId, resourceType, resourceId, projectId, issueId, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId, limit: limit.toString() });
      if (resourceType) params.append('resourceType', resourceType);
      if (resourceId) params.append('resourceId', resourceId);
      if (projectId) params.append('projectId', projectId);
      if (issueId) params.append('issueId', issueId);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      const payload = await response.json().catch(() => ({ error: 'Failed to fetch audit logs' }));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch audit logs');
      }
      return payload;
    },
    enabled: !!organizationId,
  });

  const allLogs: any[] = data?.auditLogs || [];

  const filteredLogs =
    activeFilter === 'all' ? allLogs : allLogs.filter((log) => log.action.includes(activeFilter));

  const getActionIcon = (action: string) => {
    if (action.startsWith('issue.')) return FileText;
    if (action.startsWith('sprint.')) return GitBranch;
    if (action.startsWith('project.') || action.startsWith('organization.')) return Users;
    if (action.startsWith('custom_field.')) return Settings;
    if (action.startsWith('webhook.')) return Webhook;
    if (action.startsWith('api_key.')) return Key;
    return AlertCircle;
  };

  const formatAction = (action: string) => {
    return action
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="surface-card p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="kicker">Security</span>
            <h3 className="text-sm font-semibold tracking-tight">Audit log</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card p-5">
        <div className="mb-2 space-y-0.5">
          <span className="kicker">Security</span>
          <h3 className="text-sm font-semibold tracking-tight">Audit log</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load activity.'}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5 space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="kicker">Security</span>
          <h3 className="text-sm font-semibold tracking-tight">Audit log</h3>
        </div>
        <span className="chip">
          {filteredLogs.length} {filteredLogs.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              activeFilter === f.key ? 'chip-accent' : 'chip hover:border-border-strong'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log rows */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No events found</p>
        </div>
      ) : (
        <div className="max-h-[560px] divide-y divide-border/60 overflow-y-auto custom-scrollbar -mr-2 pr-2">
          {filteredLogs.map((log) => {
            const Icon = getActionIcon(log.action);
            const isExpanded = expandedId === log.id;
            const hasChanges = log.changes && Object.keys(log.changes).length > 0;

            return (
              <div key={log.id} className={cn('border-l-2', severityBorder(log.action))}>
                <button
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150',
                    'hover:bg-accent/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    isExpanded && 'bg-accent/30'
                  )}
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={log.user.image} />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {log.user.name?.charAt(0) || log.user.email?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <span className="shrink-0 truncate text-xs font-medium text-foreground max-w-[140px]">
                    {log.user.name || log.user.email}
                  </span>

                  <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{formatAction(log.action)}</span>
                  </span>

                  <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>

                  {hasChanges && (
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  )}
                </button>

                {/* Inline expansion */}
                {isExpanded && hasChanges && (
                  <div className="animate-fade-in space-y-1 px-4 pb-3 pt-1 pl-10 text-xs">
                    {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                      <div key={field} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{field}:</span>{' '}
                        <span className="line-through">{String(change.from)}</span>
                        <span className="mx-1 text-muted-foreground/60">to</span>
                        <span className="text-foreground">{String(change.to)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
