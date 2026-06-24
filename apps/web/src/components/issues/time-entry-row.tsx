'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Check, Edit3, Trash2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDuration, type TimeEntry } from '@/lib/time-tracking/use-time-entries';

interface TimeEntryRowProps {
  entry: TimeEntry;
  canEdit?: boolean;
  onUpdate?: (patch: Partial<TimeEntry>) => void;
  onRemove?: () => void;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function avatarSrc(name: string): string {
  const slug = encodeURIComponent(name.trim().toLowerCase() || 'user');
  return `https://avatar.vercel.sh/${slug}`;
}

export function TimeEntryRow({ entry, canEdit = false, onUpdate, onRemove }: TimeEntryRowProps) {
  const t = useTranslations('issueMisc');
  const formatter = useFormatter();
  const [isEditing, setIsEditing] = useState(false);
  const [hours, setHours] = useState<string>(String(entry.hours));
  const [minutes, setMinutes] = useState<string>(String(entry.minutes));
  const [description, setDescription] = useState<string>(entry.description ?? '');

  const totalMinutes = entry.hours * 60 + entry.minutes;
  const durationLabel = formatDuration(totalMinutes);

  const handleCancel = () => {
    setHours(String(entry.hours));
    setMinutes(String(entry.minutes));
    setDescription(entry.description ?? '');
    setIsEditing(false);
  };

  const handleSave = () => {
    const parsedHours = Number.parseInt(hours, 10);
    const parsedMinutes = Number.parseInt(minutes, 10);
    const safeHours = Number.isFinite(parsedHours) ? parsedHours : 0;
    const safeMinutes = Number.isFinite(parsedMinutes) ? parsedMinutes : 0;
    if (safeHours === 0 && safeMinutes === 0) return;
    onUpdate?.({
      hours: safeHours,
      minutes: safeMinutes,
      description: description.trim() ? description.trim() : undefined,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
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
            <span className="text-muted-foreground text-xs">{'h'}</span>
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
            <span className="text-muted-foreground text-xs">{'m'}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCancel}
              aria-label={t('cancel_edit')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="default"
              size="icon-sm"
              onClick={handleSave}
              aria-label={t('save_entry')}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('work_description_placeholder')}
          rows={2}
          className="text-sm"
        />
      </div>
    );
  }

  return (
    <div className={cn('row-interactive group flex items-start gap-3 rounded-md px-2 py-2')}>
      <Avatar className="mt-0.5 h-6 w-6 shrink-0">
        <AvatarImage src={avatarSrc(entry.userName)} alt={entry.userName} />
        <AvatarFallback className="bg-muted text-[10px] font-medium">
          {getInitials(entry.userName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="text-foreground truncate font-medium">{entry.userName}</span>
          <span className="text-muted-foreground">{t('logged')}</span>
          <span className="chip text-[11px] font-medium">{durationLabel}</span>
          <span className="text-muted-foreground text-[11px]">
            {formatter.relativeTime(new Date(entry.loggedAt))}
          </span>
        </div>
        {entry.description ? (
          <p className="text-muted-foreground mt-1 whitespace-pre-wrap break-words text-sm">
            {entry.description}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            aria-label={t('edit_entry')}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t('delete_entry')}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
