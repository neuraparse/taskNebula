'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

const categories = [
  { value: 'backlog', label: 'Backlog', colorClass: 'bg-muted-foreground/40' },
  { value: 'in_progress', label: 'In Progress', colorClass: 'bg-accent-blue' },
  { value: 'in_review', label: 'In Review', colorClass: 'bg-accent-violet' },
  { value: 'done', label: 'Done', colorClass: 'bg-accent-emerald' },
  { value: 'blocked', label: 'Blocked', colorClass: 'bg-accent-rose' },
];

const categoryColors: Record<string, string> = {
  backlog: '#64748b',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  done: '#10b981',
  blocked: '#ef4444',
};

export function AddColumnDialog({ open, onOpenChange, projectId, onSuccess }: AddColumnDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow-statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, color: categoryColors[category] ?? '#64748b' }),
      });

      if (response.ok) {
        setName('');
        setCategory('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create column');
      }
    } catch (error) {
      console.error('Error creating column:', error);
      alert('Failed to create column');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Column</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="col-name" className="text-sm font-medium">
                Name
              </Label>
              <Input
                id="col-name"
                placeholder="e.g. Ready for QA"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="col-category" className="text-sm font-medium">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={setCategory}
              >
                <SelectTrigger id="col-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${cat.colorClass}`} />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name || !category}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
