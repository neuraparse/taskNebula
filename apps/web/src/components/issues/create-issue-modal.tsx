'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateIssue } from '@/lib/hooks/use-issues';
import { useWorkflowStatuses } from '@/lib/hooks/use-workflow-statuses';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

interface CreateIssueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sprintId?: string;
  /** UUID of the workflow status to pre-assign. When provided, no status picker is shown. */
  defaultStatusId?: string;
}

export function CreateIssueModal({
  open,
  onOpenChange,
  projectId,
  sprintId,
  defaultStatusId,
}: CreateIssueModalProps) {
  const t = useTranslations('issuesViews');
  const tActions = useTranslations('actions');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('task');
  const [priority, setPriority] = useState<string>('medium');
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // Only fetch statuses when no defaultStatusId is provided
  const { data: statuses, isLoading: statusesLoading } = useWorkflowStatuses(
    defaultStatusId ? undefined : projectId
  );

  // Sorted statuses by position
  const sortedStatuses = statuses ? [...statuses].sort((a, b) => a.position - b.position) : [];

  // Default selectedStatusId to the first status by position when statuses load
  useEffect(() => {
    const first = sortedStatuses[0];
    if (!defaultStatusId && first && !selectedStatusId) {
      setSelectedStatusId(first.id);
    }
  }, [defaultStatusId, sortedStatuses, selectedStatusId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setType('task');
      setPriority('medium');
      setSelectedStatusId('');
      setError(null);
      setShowError(false);
    }
  }, [open]);

  const createIssue = useCreateIssue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setShowError(true);
      setError(t('create.title_required'));
      return;
    }

    try {
      await createIssue.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        type,
        priority,
        projectId,
        sprintId,
        statusId: defaultStatusId ?? (selectedStatusId || undefined),
      });

      // Reset form
      setTitle('');
      setDescription('');
      setType('task');
      setPriority('medium');
      setSelectedStatusId('');
      setError(null);
      setShowError(false);

      // Close modal
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create issue:', err);
      setError(t('create.create_failed'));
    }
  };

  const showStatusPicker = !defaultStatusId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('create.heading')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" role="alert" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('create.title_label')}</Label>
              <Input
                id="title"
                placeholder={t('create.title_placeholder')}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (showError && e.target.value.trim()) {
                    setShowError(false);
                  }
                }}
                required
                aria-invalid={showError && !title.trim()}
                aria-describedby={showError && !title.trim() ? 'title-error' : undefined}
              />
              {showError && !title.trim() ? (
                <p id="title-error" className="text-destructive text-xs">
                  {t('create.title_required')}
                </p>
              ) : null}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('create.description_label')}</Label>
              <Textarea
                id="description"
                placeholder={t('create.description_placeholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Type and Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">{t('create.type_label')}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">{t('type.task')}</SelectItem>
                    <SelectItem value="story">{t('type.story')}</SelectItem>
                    <SelectItem value="bug">{t('type.bug')}</SelectItem>
                    <SelectItem value="epic">{t('type.epic')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">{t('create.priority_label')}</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priority.low')}</SelectItem>
                    <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                    <SelectItem value="high">{t('priority.high')}</SelectItem>
                    <SelectItem value="critical">{t('priority.critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status Row — only shown when no defaultStatusId is provided */}
            {showStatusPicker && (
              <div className="space-y-2">
                <Label htmlFor="status">{t('create.status_label')}</Label>
                <Select
                  value={selectedStatusId}
                  onValueChange={setSelectedStatusId}
                  disabled={statusesLoading || sortedStatuses.length === 0}
                >
                  <SelectTrigger id="status">
                    <SelectValue
                      placeholder={
                        statusesLoading
                          ? t('create.statuses_loading')
                          : t('create.status_placeholder')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={createIssue.isPending}
            >
              {tActions('cancel')}
            </Button>
            <Button type="submit" disabled={createIssue.isPending || !title.trim()}>
              {createIssue.isPending && (
                <span role="status" aria-live="polite" aria-busy="true" className="mr-2">
                  <span className="sr-only">{t('loading')}</span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              )}
              {t('create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
