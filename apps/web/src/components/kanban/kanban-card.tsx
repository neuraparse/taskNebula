'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KanbanCardProps {
  issue: {
    id: string;
    key?: string;
    title: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    type?: 'task' | 'bug' | 'story' | 'epic';
    assignee?: {
      name: string;
      avatar: string;
    };
    assignees?: Array<{ name: string; avatar: string }>;
    labels?: string[];
    commentCount?: number;
    attachmentCount?: number;
    dueDate?: string;
    subtaskCount?: number;
    subtaskDone?: number;
  };
  draggableId?: string;
  statusId?: string;
  issueId?: string;
  onClick?: () => void;
}

export function KanbanCard({ issue, draggableId, statusId, issueId, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: draggableId || issue.id,
    data: {
      type: 'card',
      statusId,
      issueId: issueId || draggableId || issue.id,
    },
    disabled: !draggableId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    onClick?.();
  };

  const issueKey = issue.key || issue.id;

  // Normalize to an assignees array (max 3 visible)
  const allAssignees = issue.assignees ?? (issue.assignee ? [issue.assignee] : []);
  const visibleAssignees = allAssignees.slice(0, 3);
  const extraAssignees = allAssignees.length - visibleAssignees.length;

  // Meta row: at most 3 items — prefer one label chip, assignee stack, due date
  const firstLabel = issue.labels?.[0];
  const hasDueDate = Boolean(issue.dueDate);
  const hasAssignees = visibleAssignees.length > 0;

  const dueDateLabel = hasDueDate
    ? new Date(issue.dueDate as string).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'kanban-card cursor-pointer select-none touch-manipulation group/card pl-4',
        isDragging && 'opacity-40'
      )}
    >
      {/* Priority indicator — left edge, full height */}
      <div
        className={cn(
          'priority-indicator absolute left-0 top-0 bottom-0 w-1',
          issue.priority === 'critical' && 'priority-critical',
          issue.priority === 'high' && 'priority-high',
          issue.priority === 'medium' && 'priority-medium',
          issue.priority === 'low' && 'priority-low'
        )}
      />

      {/* Issue key — tiny muted line */}
      <div className="mb-1 text-[11px] font-mono text-muted-foreground">
        {issueKey}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
        {issue.title}
      </h4>

      {/* Meta row — max 3 items */}
      {(firstLabel || hasAssignees || hasDueDate) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {firstLabel && (
              <span className="chip truncate">{firstLabel}</span>
            )}
            {dueDateLabel && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {dueDateLabel}
              </span>
            )}
          </div>

          {hasAssignees && (
            <div className="flex items-center shrink-0">
              {visibleAssignees.map((assignee, i) => {
                const initials = assignee.name
                  ?.split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <Avatar
                    key={i}
                    className={cn(
                      'h-5 w-5 rounded-full border border-border shrink-0',
                      i > 0 && '-ml-1'
                    )}
                    title={assignee.name}
                  >
                    <AvatarImage src={assignee.avatar} alt={assignee.name} />
                    <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                      {initials || '?'}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {extraAssignees > 0 && (
                <span className="-ml-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-semibold text-muted-foreground">
                  +{extraAssignees}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
