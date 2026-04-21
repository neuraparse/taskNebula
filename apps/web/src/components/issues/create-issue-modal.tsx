'use client';

import { useEffect, useState } from 'react';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('task');
  const [priority, setPriority] = useState<string>('medium');
  const [selectedStatusId, setSelectedStatusId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // Only fetch statuses when no defaultStatusId is provided
  const {
    data: statuses,
    isLoading: statusesLoading,
  } = useWorkflowStatuses(defaultStatusId ? undefined : projectId);

  // Sorted statuses by position
  const sortedStatuses = statuses
    ? [...statuses].sort((a, b) => a.position - b.position)
    : [];

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
      setError('Title is required.');
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
      setError(err instanceof Error ? err.message : 'Failed to create issue.');
    }
  };

  const showStatusPicker = !defaultStatusId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Add a new issue to your project. Fill in the details below.
          </DialogDescription>
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
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Enter issue title..."
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
                <p id="title-error" className="text-xs text-destructive">
                  Title is required.
                </p>
              ) : null}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add a description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Type and Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status Row — only shown when no defaultStatusId is provided */}
            {showStatusPicker && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={selectedStatusId}
                  onValueChange={setSelectedStatusId}
                  disabled={statusesLoading || sortedStatuses.length === 0}
                >
                  <SelectTrigger id="status">
                    <SelectValue
                      placeholder={
                        statusesLoading ? 'Loading statuses…' : 'Select a status'
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
              Cancel
            </Button>
            <Button type="submit" disabled={createIssue.isPending || !title.trim()}>
              {createIssue.isPending && (
                <span role="status" aria-live="polite" aria-busy="true" className="mr-2">
                  <span className="sr-only">Loading…</span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              )}
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
