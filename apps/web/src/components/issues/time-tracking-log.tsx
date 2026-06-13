'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useTimeEntries, type TimeEntry } from '@/lib/time-tracking/use-time-entries';
import { TimeEntryRow } from './time-entry-row';

interface TimeTrackingLogProps {
  issueId: string;
  currentUser?: { id: string; name: string };
  canEdit?: boolean;
  className?: string;
}

export function TimeTrackingLog({
  issueId,
  currentUser,
  canEdit = true,
  className,
}: TimeTrackingLogProps) {
  const t = useTranslations('issueMisc');
  const tActions = useTranslations('actions');
  const { entries, totalMinutes, formattedTotal, addEntry, updateEntry, removeEntry, isLoading } =
    useTimeEntries(issueId);

  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState<string>('0');
  const [minutes, setMinutes] = useState<string>('0');
  const [description, setDescription] = useState<string>('');

  const user = currentUser ?? { id: 'anonymous', name: t('anon_user_name') };

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.loggedAt - a.loggedAt),
    [entries]
  );

  // SSR-safe skeleton until hydrated
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true">
        <div className="flex items-center gap-2">
          <Clock className="text-muted-foreground h-3.5 w-3.5" />
          <span className="kicker">{t('time_tracking_title')}</span>
        </div>
        <div className="bg-muted/40 h-8 animate-pulse rounded-md" />
      </div>
    );
  }

  const resetForm = () => {
    setHours('0');
    setMinutes('0');
    setDescription('');
  };

  const handleCancel = () => {
    resetForm();
    setShowForm(false);
  };

  const handleSave = () => {
    const parsedHours = Number.parseInt(hours, 10);
    const parsedMinutes = Number.parseInt(minutes, 10);
    const safeHours = Number.isFinite(parsedHours) ? parsedHours : 0;
    const safeMinutes = Number.isFinite(parsedMinutes) ? parsedMinutes : 0;
    if (safeHours === 0 && safeMinutes === 0) return;
    addEntry({
      hours: safeHours,
      minutes: safeMinutes,
      description: description.trim() ? description.trim() : undefined,
      userId: user.id,
      userName: user.name,
    });
    resetForm();
    setShowForm(false);
  };

  const handleUpdate = (id: string) => (patch: Partial<TimeEntry>) => {
    updateEntry(id, patch);
  };

  const handleRemove = (id: string) => () => {
    removeEntry(id);
  };

  const hasEntries = sortedEntries.length > 0;

  return (
    <div className={cn('animate-fade-in space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="text-muted-foreground h-3.5 w-3.5" />
          <span className="kicker">{t('time_tracking_title')}</span>
          {totalMinutes > 0 ? (
            <span className="chip chip-emerald text-[11px] font-medium">
              {t('total_logged', { total: formattedTotal })}
            </span>
          ) : null}
        </div>
        {canEdit && !showForm ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('log_work')}
          </Button>
        ) : null}
      </div>

      {canEdit && showForm ? (
        <div className="border-border/70 bg-card/60 space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={99}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-8 w-16 text-sm"
                aria-label={t('hours_label')}
              />
              <span className="text-muted-foreground text-xs">{t('hours_unit')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={59}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="h-8 w-16 text-sm"
                aria-label={t('minutes_label')}
              />
              <span className="text-muted-foreground text-xs">{t('minutes_unit')}</span>
            </div>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('work_description_placeholder')}
            rows={2}
            className="text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              {tActions('cancel')}
            </Button>
            <Button variant="default" size="sm" onClick={handleSave}>
              {tActions('save')}
            </Button>
          </div>
        </div>
      ) : null}

      {hasEntries ? (
        <div className="space-y-1">
          {sortedEntries.map((entry) => (
            <TimeEntryRow
              key={entry.id}
              entry={entry}
              canEdit={canEdit && entry.userId === user.id}
              onUpdate={handleUpdate(entry.id)}
              onRemove={handleRemove(entry.id)}
            />
          ))}
        </div>
      ) : !showForm ? (
        <div className="text-muted-foreground text-sm">
          {t('no_work_logged')}{' '}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-primary transition-colors duration-200 hover:underline"
            >
              {t('add_log_work')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
