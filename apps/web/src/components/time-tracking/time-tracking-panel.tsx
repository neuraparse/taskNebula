'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Tracking
              </CardTitle>
              <CardDescription>
                Total time logged: <strong className="text-foreground">{formatTime(totalTime)}</strong>
              </CardDescription>
            </div>
            {canLog && (
              <Button size="sm" onClick={() => setShowLogDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Log Time
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {worklogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time logged yet</p>
              {canLog && (
                <p className="text-sm mt-2">Click &quot;Log Time&quot; to record your work</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {worklogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{formatTime(log.timeSpent)}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.startedAt).toLocaleDateString()} at{' '}
                        {new Date(log.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {log.description && (
                      <p className="text-sm text-muted-foreground">{log.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{log.author.name}</span>
                    </div>
                  </div>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteWorklog(log.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TimeLogDialog
        issueId={issueId}
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        onSuccess={fetchWorklogs}
      />
    </>
  );
}
