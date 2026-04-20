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

const categoryConfig: Record<string, { countBg: string; headerAccent: string }> = {
  backlog: {
    countBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
    headerAccent: 'border-t-slate-400',
  },
  todo: {
    countBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
    headerAccent: 'border-t-slate-500',
  },
  in_progress: {
    countBg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400',
    headerAccent: 'border-t-blue-500',
  },
  in_review: {
    countBg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400',
    headerAccent: 'border-t-violet-500',
  },
  done: {
    countBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
    headerAccent: 'border-t-emerald-500',
  },
  blocked: {
    countBg: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400',
    headerAccent: 'border-t-red-500',
  },
};

export function KanbanColumn({ column, issueCount, projectId, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const config = categoryConfig[column.category] ?? categoryConfig.backlog ?? {
    countBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
    headerAccent: 'border-t-slate-400',
  };

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column group flex max-h-full w-[308px] flex-shrink-0 flex-col',
          'border-t-2',
          config.headerAccent,
          isOver && 'kanban-column-drop-active'
        )}
      >
        {/* Header */}
        <div className="kanban-column-header flex items-center justify-between">
          <div className="min-w-0 flex-1 items-center gap-2.5">
            <h3 className="truncate text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
              {column.name}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'shrink-0 px-2 py-0.5 text-[11px] font-bold tabular-nums',
                  config.countBg
                )}
              >
                {issueCount}
              </span>
              <span className="text-[11px] text-muted-foreground">issues</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-muted-foreground hover:bg-muted/10 hover:text-foreground"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-muted-foreground hover:bg-muted/10 hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[160px] flex-1 overflow-y-auto px-2.5 py-2.5 custom-scrollbar">
          <div className="space-y-2.5">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-2.5 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-center rounded-none border border-dashed border-border/60 text-xs text-muted-foreground/70 hover:border-border hover:bg-muted/10 hover:text-foreground"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add issue
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
