'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useWorkflowStatuses } from '@/lib/hooks/use-workflow-statuses';
import { Loader2 } from 'lucide-react';

interface BulkOperationsDialogProps {
  selectedIssueIds: string[];
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PRIORITY_OPTION_VALUES = ['critical', 'high', 'medium', 'low'] as const;

export function BulkOperationsDialog({
  selectedIssueIds,
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: BulkOperationsDialogProps) {
  const t = useTranslations('issuesViews');
  const tActions = useTranslations('actions');
  const [operation, setOperation] = useState<'update' | 'delete'>('update');
  const [updateField, setUpdateField] = useState<'statusId' | 'priority'>('statusId');
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data: workflowStatuses = [] } = useWorkflowStatuses(projectId);

  const statusOptions = workflowStatuses.map((status) => ({
    value: status.id,
    label: status.name,
  }));

  const priorityOptions = PRIORITY_OPTION_VALUES.map((value) => ({
    value,
    label: t(`priority.${value}`),
  }));

  const handleSubmit = async () => {
    if (operation === 'update' && !newValue) {
      toast({
        title: t('bulkOps.error_title'),
        description: t('bulkOps.select_value'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const body: any = {
        action: operation,
        issueIds: selectedIssueIds,
      };

      if (operation === 'update') {
        body.updates = {
          [updateField]: newValue,
        };
      }

      const response = await fetch('/api/issues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('bulkOps.operation_failed'));
      }

      const result = await response.json();

      toast({
        title: t('bulkOps.success_title'),
        description:
          operation === 'update'
            ? t('bulkOps.updated_count', { count: result.updatedCount })
            : t('bulkOps.deleted_count', { count: result.deletedCount }),
      });

      onSuccess();
      onOpenChange(false);

      // Reset form
      setOperation('update');
      setUpdateField('statusId');
      setNewValue('');
    } catch (error: any) {
      toast({
        title: t('bulkOps.error_title'),
        description: error.message || t('bulkOps.bulk_failed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>{t('bulkOps.title')}</DialogTitle>
          <DialogDescription>
            {t('bulkOps.description', { count: selectedIssueIds.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('bulkOps.operation_label')}</Label>
            <Select
              value={operation}
              onValueChange={(value: 'update' | 'delete') => setOperation(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">{t('bulkOps.update_issues')}</SelectItem>
                <SelectItem value="delete">{t('bulkOps.delete_issues')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operation === 'update' && (
            <>
              <div className="space-y-2">
                <Label>{t('bulkOps.field_to_update')}</Label>
                <Select
                  value={updateField}
                  onValueChange={(value: 'statusId' | 'priority') => {
                    setUpdateField(value);
                    setNewValue('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="statusId">{t('field.status')}</SelectItem>
                    <SelectItem value="priority">{t('field.priority')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('bulkOps.new_value_label')}</Label>
                <Select value={newValue} onValueChange={setNewValue}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('bulkOps.value_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(updateField === 'statusId' ? statusOptions : priorityOptions).map(
                      (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {operation === 'delete' && (
            <div className="panel-danger rounded-md p-4 text-sm">
              <strong>{t('bulkOps.warning_label')}</strong>{' '}
              {t('bulkOps.delete_warning', { count: selectedIssueIds.length })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {tActions('cancel')}
          </Button>
          <Button
            variant={operation === 'delete' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {operation === 'update' ? t('bulkOps.update_submit') : t('bulkOps.delete_submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
