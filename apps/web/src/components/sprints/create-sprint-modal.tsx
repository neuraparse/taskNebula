'use client';

import { useState, useEffect } from 'react';
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
      setName(`Sprint ${sprintNumber}`);

      // Set default dates (2 weeks from today)
      const today = new Date();
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 14);

      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(twoWeeksLater.toISOString().split('T')[0]);
    }
  }, [open, existingSprints]);

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
      setError('Please fill in all required fields');
      return;
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      setError('End date must be after start date');
      return;
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 1 || days > 90) {
      setError('Sprint duration must be between 1 and 90 days');
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
      setError(err.message || 'Failed to create sprint');
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Sprint</DialogTitle>
          <DialogDescription>
            Create a new sprint to organize your work into time-boxed iterations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Sprint Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Sprint Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Sprint 1, Q1 Sprint, Feature Release"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Sprint Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal">Sprint Goal</Label>
            <Textarea
              id="goal"
              placeholder="What do you want to achieve in this sprint?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-destructive">*</span>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <Calendar className="h-4 w-4" />
              <span>
                Duration: <strong>{duration} days</strong>
                {duration === 14 && ' (2 weeks - recommended)'}
                {duration === 7 && ' (1 week)'}
                {duration === 21 && ' (3 weeks)'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={createSprint.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createSprint.isPending}>
              {createSprint.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Sprint
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

