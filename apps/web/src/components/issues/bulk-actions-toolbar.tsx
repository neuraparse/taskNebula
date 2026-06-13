'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Edit, UserPlus, Tag, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface BulkActionsToolbarProps {
  selectedIssueIds: string[];
  onClearSelection: () => void;
  onBulkUpdate: (updates: any) => Promise<void>;
  onBulkDelete: () => Promise<void>;
}

export function BulkActionsToolbar({
  selectedIssueIds,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
}: BulkActionsToolbarProps) {
  const t = useTranslations('issuesViews');
  const tActions = useTranslations('actions');
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [updateField, setUpdateField] = useState<string>('');
  const [updateValue, setUpdateValue] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (selectedIssueIds.length === 0) {
    return null;
  }

  const handleBulkUpdate = async () => {
    if (!updateField || !updateValue) return;

    setLoading(true);
    try {
      await onBulkUpdate({ [updateField]: updateValue });
      setShowUpdateDialog(false);
      setUpdateField('');
      setUpdateValue('');
      onClearSelection();
    } catch (error) {
      console.error('Bulk update failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      await onBulkDelete();
      setShowDeleteDialog(false);
      onClearSelection();
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="animate-fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        <div className="surface-glass border-border flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg">
          <span className="chip-accent text-xs">
            {t('bulk.selected_count', { count: selectedIssueIds.length })}
          </span>

          <div className="flex gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  {t('bulk.update')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('status');
                    setShowUpdateDialog(true);
                  }}
                >
                  <Tag className="mr-2 h-4 w-4" />
                  {t('bulk.change_status')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('priority');
                    setShowUpdateDialog(true);
                  }}
                >
                  <Tag className="mr-2 h-4 w-4" />
                  {t('bulk.change_priority')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('assigneeId');
                    setShowUpdateDialog(true);
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t('bulk.assign_to')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('sprintId');
                    setShowUpdateDialog(true);
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {t('bulk.move_to_sprint')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {tActions('delete')}
            </Button>

            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              {tActions('cancel')}
            </Button>
          </div>
        </div>
      </div>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>{t('bulk.update_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('bulk.update_dialog_description', { count: selectedIssueIds.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('bulk.field_label')}</Label>
              <Select value={updateField} onValueChange={setUpdateField}>
                <SelectTrigger>
                  <SelectValue placeholder={t('bulk.field_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">{t('field.status')}</SelectItem>
                  <SelectItem value="priority">{t('field.priority')}</SelectItem>
                  <SelectItem value="assigneeId">{t('field.assignee')}</SelectItem>
                  <SelectItem value="sprintId">{t('field.sprint')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('bulk.value_label')}</Label>
              {updateField === 'status' && (
                <Select value={updateValue} onValueChange={setUpdateValue}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('bulk.status_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">{t('status.todo')}</SelectItem>
                    <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                    <SelectItem value="in_review">{t('status.in_review')}</SelectItem>
                    <SelectItem value="done">{t('status.done')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {updateField === 'priority' && (
                <Select value={updateValue} onValueChange={setUpdateValue}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('bulk.priority_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priority.low')}</SelectItem>
                    <SelectItem value="medium">{t('priority.medium')}</SelectItem>
                    <SelectItem value="high">{t('priority.high')}</SelectItem>
                    <SelectItem value="urgent">{t('priority.urgent')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUpdateDialog(false)}>
              {tActions('cancel')}
            </Button>
            <Button onClick={handleBulkUpdate} disabled={loading || !updateField || !updateValue}>
              {loading ? t('bulk.updating') : t('bulk.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>{t('bulk.delete_dialog_title')}</DialogTitle>
            <DialogDescription>
              {t('bulk.delete_dialog_description', { count: selectedIssueIds.length })}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              {tActions('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={loading}>
              {loading ? t('bulk.deleting') : tActions('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
