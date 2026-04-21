'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, CheckCircle2, Circle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateIssue, useUpdateIssue } from '@/lib/hooks/use-issues';
import Link from 'next/link';

interface IssueSubtasksProps {
  issueId: string;
  projectId: string;
}

interface Subtask {
  id: string;
  key: string;
  title: string;
  statusName: string;
  statusCategory: string;
  priority: string;
}

export function IssueSubtasks({ issueId, projectId }: IssueSubtasksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue();

  // Fetch subtasks
  const { data: subtasks, isLoading, refetch } = useQuery({
    queryKey: ['subtasks', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues?parentId=${issueId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.issues || []) as Subtask[];
    },
  });

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await createIssue.mutateAsync({
        projectId,
        title: newTitle.trim(),
        type: 'task',
        priority: 'medium',
        parentId: issueId,
      });
      setNewTitle('');
      setIsAdding(false);
      refetch();
    } catch (error) {
      console.error('Error creating subtask:', error);
    }
  };

  const handleToggleComplete = async (subtask: Subtask) => {
    // Toggle between done and todo
    const newStatus = subtask.statusCategory === 'done' ? 'backlog' : 'done';
    try {
      await updateIssue.mutateAsync({
        issueId: subtask.id,
        data: { status: newStatus },
      });
      refetch();
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const completedCount = subtasks?.filter((s) => s.statusCategory === 'done').length || 0;
  const totalCount = subtasks?.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Subtasks list */}
      {subtasks && subtasks.length > 0 ? (
        <ul className="space-y-0.5">
          {subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors duration-200 group"
            >
              <button
                onClick={() => handleToggleComplete(subtask)}
                className="shrink-0"
                disabled={updateIssue.isPending}
                aria-label={subtask.statusCategory === 'done' ? 'Mark incomplete' : 'Mark complete'}
              >
                {subtask.statusCategory === 'done' ? (
                  <CheckCircle2 className="h-4 w-4 text-accent-emerald" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors duration-200" />
                )}
              </button>
              <Link
                href={`/issues/${subtask.id}`}
                className={`flex-1 text-sm hover:text-primary transition-colors duration-200 flex items-center gap-1.5 ${
                  subtask.statusCategory === 'done' ? 'line-through text-muted-foreground' : ''
                }`}
              >
                <span className="chip font-mono text-[11px] shrink-0">{subtask.key}</span>
                <span className="truncate">{subtask.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : !isAdding ? (
        <p className="text-center text-sm text-muted-foreground py-2">
          No subtasks yet
        </p>
      ) : null}

      {/* Add subtask form */}
      {isAdding ? (
        <form onSubmit={handleCreateSubtask} className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Subtask title..."
            autoFocus
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={createIssue.isPending || !newTitle.trim()}>
            {createIssue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add subtask
        </Button>
      )}
    </div>
  );
}

