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

// Category-based colors (modern, professional palette)
const categoryColors: Record<string, string> = {
  backlog: '#64748b',      // Slate
  in_progress: '#3b82f6',  // Blue
  in_review: '#8b5cf6',    // Purple
  done: '#10b981',         // Emerald
  blocked: '#ef4444',      // Red
};

export function KanbanColumn({ column, issueCount, projectId, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const columnColor = categoryColors[column.category] || column.color;

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          'flex w-72 flex-shrink-0 flex-col rounded-lg border bg-card/50 backdrop-blur-sm transition-all',
          isOver && 'ring-2 ring-primary ring-offset-2 bg-primary/5'
        )}
      >
        {/* Column Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="h-2 w-2 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: columnColor }}
            />
            <h3 className="font-semibold text-sm truncate tracking-tight">{column.name}</h3>
            <span className="rounded-md bg-background px-1.5 py-0.5 text-xs font-semibold text-muted-foreground flex-shrink-0 border">
              {issueCount}
            </span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-background"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-background">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Column Content */}
        <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar min-h-[200px]">
          {children}
        </div>
      </div>

      {/* Create Issue Modal */}
      <CreateIssueModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
      />
    </>
  );
}

