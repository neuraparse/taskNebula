'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TimeLogDialog } from './time-log-dialog';
import { Clock, Plus, Trash2 } from 'lucide-react';

interface Worklog {
  id: string;
  timeSpent: number;
  description: string | null;
  startedAt: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

interface TimeTrackingPanelProps {
  issueId: string;
  canLog: boolean;
  canDelete: boolean;
}

export function TimeTrackingPanel({ issueId, canLog, canDelete }: TimeTrackingPanelProps) {
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorklogs();
  }, [issueId]);

  const fetchWorklogs = async () => {
    try {
      const response = await fetch(`/api/issues/${issueId}/worklogs`);
      if (!response.ok) throw new Error('Failed to fetch worklogs');
      const data = await response.json();
      setWorklogs(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load time logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWorklog = async (worklogId: string) => {
    if (!confirm('Are you sure you want to delete this time log?')) {
      return;
    }

    try {
      const response = await fetch(`/api/issues/${issueId}/worklogs/${worklogId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete worklog');

      toast({
        title: 'Success',
        description: 'Time log deleted',
      });

      fetchWorklogs();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete time log',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    return parts.join(' ') || '0m';
  };

  const totalTime = worklogs.reduce((sum, log) => sum + log.timeSpent, 0);

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading time logs...</div>;
  }

  return (
    <>
      <div className="space-y-3 animate-fade-up">
        {/* Compact timer/summary bar */}
        <div className="surface-card flex items-center gap-3 px-3 py-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium">Time tracking</span>
          <span className="chip text-[11px]">Paused</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(totalTime)}
          </span>
          {canLog ? (
            <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setShowLogDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Log time
            </Button>
          ) : null}
        </div>

        {/* Log rows */}
        {worklogs.length === 0 ? (
          <div className="surface-card py-8 text-center space-y-2">
            <Clock className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No time logged yet.</p>
          </div>
        ) : (
          <div className="surface-card divide-y divide-border/60 stagger">
            {worklogs.map((log) => (
              <div
                key={log.id}
                className="row-interactive flex items-center gap-3 px-4 py-2.5"
              >
                <span className="chip-accent shrink-0 font-mono text-[11px]">{formatTime(log.timeSpent)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">
                    <span className="font-medium">{log.author.name}</span>
                    {log.description ? (
                      <>
                        <span className="mx-1.5 text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{log.description}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(log.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                {canDelete ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteWorklog(log.id)}
                    aria-label="Delete worklog"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <TimeLogDialog
        issueId={issueId}
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        onSuccess={fetchWorklogs}
      />
    </>
  );
}
