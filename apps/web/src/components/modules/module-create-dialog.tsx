'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ModuleStatus, ProjectModule, UseModulesResult } from '@/lib/modules/use-modules';

interface ModuleCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createModule: UseModulesResult['createModule'];
  onCreated?: (module: ProjectModule) => void;
}

const STATUS_OPTIONS: { value: ModuleStatus; labelKey: string }[] = [
  { value: 'backlog', labelKey: 'status_backlog' },
  { value: 'planned', labelKey: 'status_planned' },
  { value: 'in_progress', labelKey: 'status_in_progress' },
  { value: 'paused', labelKey: 'status_paused' },
  { value: 'completed', labelKey: 'status_completed' },
  { value: 'cancelled', labelKey: 'status_cancelled' },
];

const INITIAL_STATUS: ModuleStatus = 'planned';

export function ModuleCreateDialog({
  open,
  onOpenChange,
  createModule,
  onCreated,
}: ModuleCreateDialogProps) {
  const t = useTranslations('planning');
  const tActions = useTranslations('actions');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ModuleStatus>(INITIAL_STATUS);
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [leadName, setLeadName] = useState('');
  const [membersText, setMembersText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setStatus(INITIAL_STATUS);
      setStartDate('');
      setTargetDate('');
      setLeadName('');
      setMembersText('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('error_module_name_required'));
      return;
    }

    if (startDate && targetDate) {
      const s = new Date(startDate);
      const target = new Date(targetDate);
      if (target < s) {
        setError(t('error_target_before_start'));
        return;
      }
    }

    const memberIds = membersText
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    try {
      const created = await createModule({
        name: trimmedName,
        description: description.trim() || undefined,
        status,
        leadName: leadName.trim() || undefined,
        leadId: undefined,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
        memberIds,
        totalIssues: 0,
        completedIssues: 0,
      });

      onCreated?.(created);
      onOpenChange(false);
    } catch {
      setError(t('error_create_module'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">{t('new_module')}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {t('module_dialog_desc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="module-name" className="text-sm">
              {t('label_name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="module-name"
              placeholder={t('module_name_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="module-description" className="text-sm">
              {t('label_description')}
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                {t('optional')}
              </span>
            </Label>
            <Textarea
              id="module-description"
              placeholder={t('module_description_placeholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('label_status')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ModuleStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="module-start" className="text-sm">
                {t('label_start_date')}
              </Label>
              <Input
                id="module-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="module-target" className="text-sm">
                {t('label_target_date')}
              </Label>
              <Input
                id="module-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

          {/* Lead (placeholder) */}
          <div className="space-y-1.5">
            <Label htmlFor="module-lead" className="text-sm">
              {t('label_lead')}
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                {t('placeholder_marker')}
              </span>
            </Label>
            <Input
              id="module-lead"
              placeholder={t('lead_placeholder')}
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
          </div>

          {/* Members (placeholder) */}
          <div className="space-y-1.5">
            <Label htmlFor="module-members" className="text-sm">
              {t('label_members')}
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                {t('members_placeholder_marker')}
              </span>
            </Label>
            <Input
              id="module-members"
              placeholder={t('members_placeholder')}
              value={membersText}
              onChange={(e) => setMembersText(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {tActions('cancel')}
            </Button>
            <Button type="submit" size="sm">
              {t('create_module')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
