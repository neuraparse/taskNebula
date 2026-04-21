'use client';

import { Plus } from 'lucide-react';
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

export function KanbanColumn({ column, issueCount, projectId, statusId, issueIds, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', statusId, category: column.category },
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'kanban-column group flex h-full min-h-[520px] w-[320px] flex-shrink-0 flex-col touch-manipulation',
          isOver && 'kanban-column-drop-active'
        )}
      >
        {/* Header: name + count + add */}
        <div className="kanban-column-header flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">
              {column.name}
            </h3>
            <span className="chip tabular-nums">{issueCount}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setCreateModalOpen(true)}
            aria-label="Add issue"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-[420px] flex-1 overflow-y-auto px-2.5 py-2.5 custom-scrollbar">
          <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {children}
            </div>
          </SortableContext>
          {issueCount === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No issues
            </p>
          )}
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
