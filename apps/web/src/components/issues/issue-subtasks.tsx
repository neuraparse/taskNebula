'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, CheckCircle2, Circle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUpdateIssue } from '@/lib/hooks/use-issues';
import { useCreateSubIssue, useSubIssueParentContext } from '@/lib/hooks/use-subtask-create';
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
  const t = useTranslations('subtaskCreate');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createSubIssue = useCreateSubIssue();
  const updateIssue = useUpdateIssue();
  const { data: parentContext } = useSubIssueParentContext(issueId, projectId);

  // Fetch subtasks
  const {
    data: subtasks,
    isLoading,
    refetch,
  } = useQuery({
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

    setCreateError(null);
    try {
      await createSubIssue.mutateAsync({
        parentId: issueId,
        title: newTitle.trim(),
        // Inherit the parent's project + sprint/epic when present, falling
        // back to the project id we already hold while the parent loads.
        context: parentContext ?? { projectId },
      });
      setNewTitle('');
      setIsAdding(false);
      refetch();
    } catch (error) {
      console.error('Error creating subtask:', error);
      setCreateError(t('createFailed'));
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
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-muted-foreground text-xs">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Subtasks list */}
      {subtasks && subtasks.length > 0 ? (
        <ul className="stagger space-y-0.5">
          {subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="row-interactive group flex items-center gap-2 rounded-md px-2 py-1.5"
            >
              <button
                onClick={() => handleToggleComplete(subtask)}
                className="shrink-0"
                disabled={updateIssue.isPending}
                aria-label={subtask.statusCategory === 'done' ? 'Mark incomplete' : 'Mark complete'}
              >
                {subtask.statusCategory === 'done' ? (
                  <CheckCircle2 className="text-accent-emerald h-4 w-4" />
                ) : (
                  <Circle className="text-muted-foreground hover:text-primary h-4 w-4 transition-colors duration-150" />
                )}
              </button>
              <Link
                href={`/issues/${subtask.id}`}
                className={`hover:text-primary ease-snap flex flex-1 items-center gap-1.5 text-sm transition-colors duration-150 ${
                  subtask.statusCategory === 'done' ? 'text-muted-foreground line-through' : ''
                }`}
              >
                <span className="chip shrink-0 rounded-sm font-mono text-[11px]">
                  {subtask.key}
                </span>
                <span className="truncate">{subtask.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : !isAdding ? (
        <p className="text-muted-foreground py-2 text-center text-sm">No subtasks yet</p>
      ) : null}

      {/* Add subtask form */}
      {isAdding ? (
        <form onSubmit={handleCreateSubtask} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Input
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder={t('placeholder')}
              autoFocus
              className="flex-1"
              aria-invalid={!!createError}
            />
            <Button type="submit" size="sm" disabled={createSubIssue.isPending || !newTitle.trim()}>
              {createSubIssue.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('addSubIssue')
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setCreateError(null);
              }}
              aria-label={t('addSubIssue')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {createSubIssue.isPending ? (
            <p className="text-muted-foreground px-1 text-xs">{t('creating')}</p>
          ) : null}
          {createError ? (
            <p className="text-destructive px-1 text-xs" role="alert">
              {createError}
            </p>
          ) : null}
        </form>
      ) : (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setIsAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addSubIssue')}
        </Button>
      )}
    </div>
  );
}
