'use client';

import { Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';

interface KanbanColumnProps {
  column: {
    id: string;
    name: string;
    color: string;
    category: string;
  };
  issueCount: number;
  projectId: string;
  children: React.ReactNode;
}

const categoryConfig: Record<string, { dot: string; countBg: string }> = {
  backlog: {
    dot: 'bg-slate-400',
    countBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
  },
  todo: {
    dot: 'bg-slate-500',
    countBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
  },
  in_progress: {
    dot: 'bg-blue-500',
    countBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  },
  in_review: {
    dot: 'bg-violet-500',
    countBg: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  },
  done: {
    dot: 'bg-emerald-500',
    countBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  blocked: {
    dot: 'bg-red-500',
    countBg: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
  },
};

export function KanbanColumn({ column, issueCount, projectId, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const config = categoryConfig[column.category] || categoryConfig.backlog;

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column group flex w-[280px] flex-shrink-0 flex-col max-h-full',
          isOver && 'kanban-column-drop-active'
        )}
      >
        {/* Header */}
        <div className="kanban-column-header flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn('h-2 w-2 rounded-full shrink-0', config.dot)} />
            <h3 className="font-semibold text-sm truncate text-foreground">
              {column.name}
            </h3>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 tabular-nums',
              config.countBg
            )}>
              {issueCount}
            </span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-[120px]">
          <div className="space-y-2">
            {children}
          </div>
        </div>

        {/* Footer - Add Issue */}
        <div className="p-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-[13px]">Add issue</span>
          </Button>
        </div>
      </div>

      <CreateIssueModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
      />
    </>
  );
}
