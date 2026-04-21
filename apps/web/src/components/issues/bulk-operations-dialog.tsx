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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface BulkOperationsDialogProps {
  selectedIssueIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function BulkOperationsDialog({
  selectedIssueIds,
  open,
  onOpenChange,
  onSuccess,
}: BulkOperationsDialogProps) {
  const [operation, setOperation] = useState<'update' | 'delete'>('update');
  const [updateField, setUpdateField] = useState<'status' | 'priority'>('status');
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (operation === 'update' && !newValue) {
      toast({
        title: 'Error',
        description: 'Please select a value',
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
        throw new Error(error.error || 'Operation failed');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description:
          operation === 'update'
            ? `Updated ${result.updatedCount} issue(s)`
            : `Deleted ${result.deletedCount} issue(s)`,
      });

      onSuccess();
      onOpenChange(false);

      // Reset form
      setOperation('update');
      setUpdateField('status');
      setNewValue('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to perform bulk operation',
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
          <DialogTitle>Bulk Operations</DialogTitle>
          <DialogDescription>
            Perform actions on {selectedIssueIds.length} selected issue(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select
              value={operation}
              onValueChange={(value: 'update' | 'delete') => setOperation(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">Update Issues</SelectItem>
                <SelectItem value="delete">Delete Issues</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {operation === 'update' && (
            <>
              <div className="space-y-2">
                <Label>Field to Update</Label>
                <Select
                  value={updateField}
                  onValueChange={(value: 'status' | 'priority') => {
                    setUpdateField(value);
                    setNewValue('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>New Value</Label>
                <Select value={newValue} onValueChange={setNewValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    {(updateField === 'status' ? STATUS_OPTIONS : PRIORITY_OPTIONS).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {operation === 'delete' && (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              <strong>Warning:</strong> This action cannot be undone. This will permanently delete{' '}
              {selectedIssueIds.length} issue(s).
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={operation === 'delete' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {operation === 'update' ? 'Update issues' : 'Delete issues'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
