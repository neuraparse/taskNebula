'use client';

import { useEffect, useState } from 'react';
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
import type {
  ModuleStatus,
  ProjectModule,
  UseModulesResult,
} from '@/lib/modules/use-modules';

interface ModuleCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createModule: UseModulesResult['createModule'];
  onCreated?: (module: ProjectModule) => void;
}

const STATUS_OPTIONS: { value: ModuleStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const INITIAL_STATUS: ModuleStatus = 'planned';

export function ModuleCreateDialog({
  open,
  onOpenChange,
  createModule,
  onCreated,
}: ModuleCreateDialogProps) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Module name is required');
      return;
    }

    if (startDate && targetDate) {
      const s = new Date(startDate);
      const t = new Date(targetDate);
      if (t < s) {
        setError('Target date must be on or after the start date');
        return;
      }
    }

    const memberIds = membersText
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    const created = createModule({
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold">New module</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Group related work into a feature area or mini-project.
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
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="module-name"
              placeholder="e.g., Auth, Billing, Onboarding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="module-description" className="text-sm">
              Description
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="module-description"
              placeholder="What does this module cover?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-sm">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ModuleStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="module-start" className="text-sm">
                Start date
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
                Target date
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
              Lead
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                (placeholder)
              </span>
            </Label>
            <Input
              id="module-lead"
              placeholder="Assign a lead (member picker coming soon)"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
          </div>

          {/* Members (placeholder) */}
          <div className="space-y-1.5">
            <Label htmlFor="module-members" className="text-sm">
              Members
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                (placeholder — comma-separated IDs)
              </span>
            </Label>
            <Input
              id="module-members"
              placeholder="user-1, user-2"
              value={membersText}
              onChange={(e) => setMembersText(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create module
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
