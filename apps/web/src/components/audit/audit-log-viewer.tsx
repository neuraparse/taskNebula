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

  const filteredLogs = activeFilter === 'all'
    ? allLogs
    : allLogs.filter((log) => log.action.includes(activeFilter));

  const getActionIcon = (action: string) => {
    if (action.startsWith('issue.')) return FileText;
    if (action.startsWith('sprint.')) return GitBranch;
    if (action.startsWith('project.') || action.startsWith('organization.')) return Users;
    if (action.startsWith('custom_field.')) return Settings;
    if (action.startsWith('webhook.')) return Webhook;
    if (action.startsWith('api_key.')) return Key;
    return AlertCircle;
  };

  const getActionChipClass = (action: string) => {
    if (action.includes('created')) return 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20';
    if (action.includes('deleted') || action.includes('revoked')) return 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20';
    if (action.includes('updated') || action.includes('changed')) return 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20';
    return 'bg-muted text-muted-foreground border border-border';
  };

  const formatAction = (action: string) => {
    return action
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-0.5">
            <span className="kicker">Security</span>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Audit Log</h3>
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
      <div className="surface-card p-6">
        <div className="space-y-0.5 mb-2">
          <span className="kicker">Security</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Audit Log</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load activity.'}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="kicker">Security</span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Audit Log</h3>
        </div>
        <span className="chip">{filteredLogs.length} {filteredLogs.length === 1 ? 'event' : 'events'}</span>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              activeFilter === f.key
                ? 'chip-accent'
                : 'chip hover:border-border-strong'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log rows */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No events found</p>
        </div>
      ) : (
        <div className="max-h-[560px] overflow-y-auto custom-scrollbar -mr-2 pr-2 divide-y divide-border">
          {filteredLogs.map((log) => {
            const Icon = getActionIcon(log.action);
            const isExpanded = expandedId === log.id;
            const hasChanges = log.changes && Object.keys(log.changes).length > 0;

            return (
              <div key={log.id}>
                <button
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-2 text-left transition-colors duration-200',
                    'h-9 rounded-sm hover:bg-accent/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    isExpanded && 'bg-accent/20'
                  )}
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={log.user.image} />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {log.user.name?.charAt(0) || log.user.email?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <span className="text-xs font-medium text-foreground truncate min-w-0 shrink-0 max-w-[120px]">
                    {log.user.name || log.user.email}
                  </span>

                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 shrink-0',
                    getActionChipClass(log.action)
                  )}>
                    <Icon className="h-2.5 w-2.5" />
                    {formatAction(log.action)}
                  </span>

                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>

                  {hasChanges && (
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  )}
                </button>

                {/* Inline expansion */}
                {isExpanded && hasChanges && (
                  <div className="animate-fade-in px-3 pb-3 pt-1 ml-8 space-y-1">
                    {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                      <div key={field} className="text-xs text-muted-foreground">
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
