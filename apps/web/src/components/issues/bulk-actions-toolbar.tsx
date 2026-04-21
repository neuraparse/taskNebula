'use client';

import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
        <div className="surface-glass border border-border rounded-full shadow-lg px-4 py-2.5 flex items-center gap-3">
          <span className="chip-accent text-xs">
            {selectedIssueIds.length} selected
          </span>

          <div className="flex gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Update
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('status');
                    setShowUpdateDialog(true);
                  }}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Change Status
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('priority');
                    setShowUpdateDialog(true);
                  }}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Change Priority
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('assigneeId');
                    setShowUpdateDialog(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign To
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setUpdateField('sprintId');
                    setShowUpdateDialog(true);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Move to Sprint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>

            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Update Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update Issues</DialogTitle>
            <DialogDescription>
              Update {selectedIssueIds.length} selected issue(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Field</Label>
              <Select value={updateField} onValueChange={setUpdateField}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="assigneeId">Assignee</SelectItem>
                  <SelectItem value="sprintId">Sprint</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Value</Label>
              {updateField === 'status' && (
                <Select value={updateValue} onValueChange={setUpdateValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {updateField === 'priority' && (
                <Select value={updateValue} onValueChange={setUpdateValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpdate} disabled={loading || !updateField || !updateValue}>
              {loading ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Issues</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIssueIds.length} issue(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

