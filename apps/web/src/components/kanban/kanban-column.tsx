'use client';

import { Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
  statusId: string;
  issueIds: string[];
  children: React.ReactNode;
}

const categoryCountChip: Record<string, string> = {
  backlog: 'chip',
  todo: 'chip',
  in_progress: 'chip-accent',
  in_review: 'bg-accent-violet/10 text-accent-violet border border-accent-violet/20 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-flex items-center',
  done: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-flex items-center',
  blocked: 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-flex items-center',
};

const categoryTopBorder: Record<string, string> = {
  backlog: 'border-t-2 border-t-muted-foreground/40',
  todo: 'border-t-2 border-t-muted-foreground/60',
  in_progress: 'border-t-2 border-t-accent-blue',
  in_review: 'border-t-2 border-t-accent-violet',
  done: 'border-t-2 border-t-accent-emerald',
  blocked: 'border-t-2 border-t-accent-rose',
};

export function KanbanColumn({ column, issueCount, projectId, statusId, issueIds, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', statusId, category: column.category },
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const topBorder = categoryTopBorder[column.category] ?? categoryTopBorder.backlog;
  const countChipClass = categoryCountChip[column.category] ?? categoryCountChip.backlog;

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column group flex max-h-full w-[308px] flex-shrink-0 flex-col touch-manipulation',
          topBorder,
          isOver && 'kanban-column-drop-active'
        )}
      >
        {/* Header */}
        <div className="kanban-column-header flex items-center justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">
              {column.name}
            </h3>
            <span className={cn('self-start tabular-nums', countChipClass === 'chip' || countChipClass === 'chip-accent' ? '' : '')}>
              <span className={countChipClass}>{issueCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setCreateModalOpen(true)}
              aria-label="Add issue"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Column options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          'min-h-[160px] flex-1 overflow-y-auto px-2.5 py-2.5 custom-scrollbar transition-colors duration-150',
          isOver && 'bg-primary/5'
        )}>
          <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {children}
            </div>
          </SortableContext>
          {issueCount === 0 && (
            <p className="text-xs text-muted-foreground/60 italic text-center py-6">
              Drop issues here or click + to create one
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-2.5 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-center rounded-md border border-dashed border-border/50 text-xs text-muted-foreground/60 transition-all duration-200 ease-smooth hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add issue
          </Button>
        </div>
      </div>

      <CreateIssueModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
        defaultStatusId={statusId}
      />
    </>
  );
}
