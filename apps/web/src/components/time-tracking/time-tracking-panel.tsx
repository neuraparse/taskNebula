'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TimeLogDialog } from './time-log-dialog';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

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
  const t = useTranslations('appShell');
  const formatter = useFormatter();

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
        title: t('common.errorTitle'),
        description: t('timeTracking.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWorklog = async (worklogId: string) => {
    if (!confirm(t('timeTracking.deleteConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/issues/${issueId}/worklogs/${worklogId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete worklog');

      toast({
        title: t('common.successTitle'),
        description: t('timeTracking.deleted'),
      });

      fetchWorklogs();
    } catch (error) {
      toast({
        title: t('common.errorTitle'),
        description: t('timeTracking.deleteFailed'),
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
    return <div className="text-muted-foreground p-4 text-sm">{t('timeTracking.loading')}</div>;
  }

  return (
    <>
      <div className="animate-fade-up space-y-3">
        {/* Compact timer/summary bar */}
        <div className="surface-card flex items-center gap-3 px-3 py-2">
          <Clock className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">{t('timeTracking.heading')}</span>
          <span className="chip text-[11px]">{t('timeTracking.paused')}</span>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatTime(totalTime)}
          </span>
          {canLog ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7"
              onClick={() => setShowLogDialog(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('timeTracking.logTime')}
            </Button>
          ) : null}
        </div>

        {/* Log rows */}
        {worklogs.length === 0 ? (
          <div className="surface-card space-y-2 py-8 text-center">
            <Clock className="text-muted-foreground/40 mx-auto h-6 w-6" />
            <p className="text-muted-foreground text-sm">{t('timeTracking.empty')}</p>
          </div>
        ) : (
          <div className="surface-card divide-border/60 stagger divide-y">
            {worklogs.map((log) => (
              <div key={log.id} className="row-interactive flex items-center gap-3 px-4 py-2.5">
                <span className="chip-accent shrink-0 font-mono text-[11px]">
                  {formatTime(log.timeSpent)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-xs">
                    <span className="font-medium">{log.author.name}</span>
                    {log.description ? (
                      <>
                        <span className="text-muted-foreground mx-1.5">·</span>
                        <span className="text-muted-foreground">{log.description}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                  {formatter.dateTime(new Date(log.startedAt), {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {canDelete ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
                    onClick={() => deleteWorklog(log.id)}
                    aria-label={t('timeTracking.deleteWorklog')}
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
