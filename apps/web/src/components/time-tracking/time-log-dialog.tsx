'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Clock, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TimeLogDialogProps {
  issueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TimeLogDialog({ issueId, open, onOpenChange, onSuccess }: TimeLogDialogProps) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const t = useTranslations('appShell');
  const tActions = useTranslations('actions');

  const handleSubmit = async () => {
    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

    if (totalMinutes === 0) {
      toast({
        title: t('common.errorTitle'),
        description: t('timeLog.enterTimeError'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/issues/${issueId}/worklogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSpent: totalMinutes,
          description: description || null,
          startedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('timeLog.logFailed'));
      }

      toast({
        title: t('common.successTitle'),
        description: t('timeLog.logged', { hours: hours || 0, minutes: minutes || 0 }),
      });

      // Reset form
      setHours('');
      setMinutes('');
      setDescription('');

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('common.errorTitle'),
        description: error.message || t('timeLog.logFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="text-accent-emerald h-4 w-4" />
            {t('timeLog.title')}
          </DialogTitle>
          <DialogDescription>{t('timeLog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours">{t('timeLog.hours')}</Label>
              <Input
                id="hours"
                type="number"
                min="0"
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">{t('timeLog.minutes')}</Label>
              <Input
                id="minutes"
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t('timeLog.descriptionLabel')}{' '}
              <span className="text-muted-foreground font-normal">{t('timeLog.optional')}</span>
            </Label>
            <Textarea
              id="description"
              placeholder={t('timeLog.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {(hours || minutes) && (
            <div className="surface-inset rounded-md px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t('timeLog.totalLabel')} </span>
              <span className="text-foreground font-mono font-semibold">
                {t('timeLog.duration', { hours: hours || 0, minutes: minutes || 0 })}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {tActions('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('timeLog.logButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
