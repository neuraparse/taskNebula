'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  GitBranch,
  Users,
  Settings,
  Webhook,
  Key,
  AlertCircle,
} from 'lucide-react';

interface AuditLogViewerProps {
  organizationId: string;
  resourceType?: string;
  resourceId?: string;
  projectId?: string;
  issueId?: string;
  limit?: number;
}

export function AuditLogViewer({
  organizationId,
  resourceType,
  resourceId,
  projectId,
  issueId,
  limit = 50,
}: AuditLogViewerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', organizationId, resourceType, resourceId, projectId, issueId, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ organizationId, limit: limit.toString() });
      if (resourceType) params.append('resourceType', resourceType);
      if (resourceId) params.append('resourceId', resourceId);
      if (projectId) params.append('projectId', projectId);
      if (issueId) params.append('issueId', issueId);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      return response.json();
    },
    enabled: !!organizationId,
  });

  const auditLogs = data?.auditLogs || [];

  const getActionIcon = (action: string) => {
    if (action.startsWith('issue.')) return FileText;
    if (action.startsWith('sprint.')) return GitBranch;
    if (action.startsWith('project.') || action.startsWith('organization.')) return Users;
    if (action.startsWith('custom_field.')) return Settings;
    if (action.startsWith('webhook.')) return Webhook;
    if (action.startsWith('api_key.')) return Key;
    return AlertCircle;
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'bg-green-100 text-green-800';
    if (action.includes('deleted') || action.includes('revoked')) return 'bg-red-100 text-red-800';
    if (action.includes('updated') || action.includes('changed')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatAction = (action: string) => {
    return action
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>
          {auditLogs.length} {auditLogs.length === 1 ? 'event' : 'events'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {auditLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No activity yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log: any) => {
                const Icon = getActionIcon(log.action);
                return (
                  <div key={log.id} className="flex gap-3 pb-4 border-b last:border-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={log.user.image} />
                      <AvatarFallback>
                        {log.user.name?.charAt(0) || log.user.email?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{log.user.name || log.user.email}</span>
                        <Badge className={getActionColor(log.action)}>
                          <Icon className="h-3 w-3 mr-1" />
                          {formatAction(log.action)}
                        </Badge>
                      </div>

                      {log.changes && (
                        <div className="text-sm text-muted-foreground">
                          {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                            <div key={field}>
                              <span className="font-medium">{field}:</span>{' '}
                              <span className="line-through">{String(change.from)}</span> →{' '}
                              <span className="text-foreground">{String(change.to)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

