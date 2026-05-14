'use client';

import { Plus, Inbox, Sparkles } from 'lucide-react';
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
            // FEAT-31 empty state — illustration placeholder + primary CTA +
            // secondary "Generate with AI" CTA. The AI CTA is intentionally
            // a TODO: wire to /api/ai/generate-issue once the endpoint
            // accepts a column/status context (tracked separately).
            <div className="mx-1 mt-2 flex flex-col items-center gap-3 rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/60">
                <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">No issues here yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Drop work into <span className="font-medium text-foreground/80">{column.name}</span> or create one.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-1.5 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  New issue
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  // TODO(ai): hook into /api/ai/issues/generate with column context
                  onClick={() => {
                    // eslint-disable-next-line no-console
                    console.info('[ai-generate] kanban column empty state — TODO wire up', {
                      projectId,
                      statusId,
                    });
                  }}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Generate with AI
                </Button>
              </div>
            </div>
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
