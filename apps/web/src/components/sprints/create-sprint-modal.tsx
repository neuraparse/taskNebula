'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateSprint, useSprints } from '@/lib/hooks/use-sprints';

interface CreateSprintModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSprintModal({ projectId, open, onOpenChange }: CreateSprintModalProps) {
  const t = useTranslations('sprints');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createSprint = useCreateSprint();
  const { data: existingSprints } = useSprints(projectId);

  // Generate default sprint name based on existing sprints
  useEffect(() => {
    if (open && existingSprints) {
      const sprintNumber = existingSprints.length + 1;
      setName(t('defaultName', { number: sprintNumber }));

      // Set default dates (2 weeks from today)
      const today = new Date();
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 14);

      setStartDate(today.toISOString().split('T')[0] ?? '');
      setEndDate(twoWeeksLater.toISOString().split('T')[0] ?? '');
    }
  }, [open, existingSprints, t]);

  // Calculate sprint duration
  const getDuration = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const duration = getDuration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !startDate || !endDate) {
      setError(t('errors.requiredFields'));
      return;
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      setError(t('errors.endAfterStart'));
      return;
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 1 || days > 90) {
      setError(t('errors.durationRange'));
      return;
    }

    try {
      await createSprint.mutateAsync({
        projectId,
        name: name.trim(),
        goal: goal.trim() || undefined,
        startDate: start,
        endDate: end,
      });

      // Reset form
      setName('');
      setGoal('');
      setStartDate('');
      setEndDate('');
      setError(null);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error creating sprint:', err);
      setError(err.message || t('errors.createFailed'));
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setError(null);
      setName('');
      setGoal('');
      setStartDate('');
      setEndDate('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">{t('createTitle')}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {t('createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Sprint Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">
              {t('nameLabel')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Sprint Goal */}
          <div className="space-y-1.5">
            <Label htmlFor="goal" className="text-sm">
              {t('goalLabel')}
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                {t('optional')}
              </span>
            </Label>
            <Textarea
              id="goal"
              placeholder={t('goalPlaceholder')}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-sm">
                {t('startDateLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-sm">
                {t('endDateLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                required
              />
            </div>
          </div>

          {/* Duration Info */}
          {duration && duration > 0 && (
            <div className="surface-inset text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="text-foreground font-medium">
                  {t('durationDays', { count: duration })}
                </span>
                {duration === 14 && t('durationTwoWeeks')}
                {duration === 7 && t('durationOneWeek')}
                {duration === 21 && t('durationThreeWeeks')}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleClose(false)}
              disabled={createSprint.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={createSprint.isPending}>
              {createSprint.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('createButton')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
