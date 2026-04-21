'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TimeLogDialog } from './time-log-dialog';
import { Clock, Plus, Trash2, User } from 'lucide-react';

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
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Time Tracking</span>
            {totalTime > 0 && (
              <span className="chip">{formatTime(totalTime)} total</span>
            )}
          </div>
          {canLog && (
            <Button size="sm" variant="ghost" onClick={() => setShowLogDialog(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Log time
            </Button>
          )}
        </div>

        {/* Log rows */}
        {worklogs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>No time logged yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {worklogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors duration-200 hover:bg-accent/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="chip-accent shrink-0">{formatTime(log.timeSpent)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{log.author.name}</span>
                      <span className="text-border-strong">·</span>
                      <span className="shrink-0">
                        {new Date(log.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {log.description && (
                      <p className="truncate text-xs text-muted-foreground">{log.description}</p>
                    )}
                  </div>
                </div>
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteWorklog(log.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
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
