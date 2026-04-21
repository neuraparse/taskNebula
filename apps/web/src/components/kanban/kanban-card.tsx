'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MessageSquare, Paperclip, Calendar, CheckCircle2, BookOpen, CheckSquare, Bug, Zap } from 'lucide-react';
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

const typeConfig: Record<NonNullable<KanbanCardProps['issue']['type']>, { icon: React.ElementType; color: string }> = {
  story: { icon: BookOpen, color: 'text-accent-emerald' },
  task: { icon: CheckSquare, color: 'text-accent-blue' },
  bug: { icon: Bug, color: 'text-accent-rose' },
  epic: { icon: Zap, color: 'text-accent-violet' },
};

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

  const tConfig = typeConfig[issue.type || 'task'] ?? typeConfig.task;
  const TypeIcon = tConfig.icon;
  const hasFooter = issue.commentCount || issue.attachmentCount || issue.dueDate || issue.subtaskCount;
  const issueKey = issue.key || issue.id;

  // Normalize to an assignees array (max 3 visible)
  const allAssignees = issue.assignees ?? (issue.assignee ? [issue.assignee] : []);
  const visibleAssignees = allAssignees.slice(0, 3);
  const extraAssignees = allAssignees.length - visibleAssignees.length;

  const visibleLabels = (issue.labels ?? []).slice(0, 2);
  const extraLabels = (issue.labels ?? []).length - visibleLabels.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'kanban-card cursor-pointer select-none touch-manipulation group/card',
        isDragging && 'opacity-40'
      )}
    >
      {/* Priority indicator — left edge */}
      <div
        className={cn(
          'absolute left-0 top-2 bottom-2 priority-indicator',
          issue.priority === 'critical' && 'priority-critical',
          issue.priority === 'high' && 'priority-high',
          issue.priority === 'medium' && 'priority-medium',
          issue.priority === 'low' && 'priority-low'
        )}
      />

      {/* Top: Type icon + Key */}
      <div className="mb-2.5 flex items-center justify-between gap-2 pl-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', tConfig.color)} />
          <span className="text-[11px] font-mono font-medium text-muted-foreground">
            {issueKey}
          </span>
        </div>

        {/* Assignee avatars */}
        {visibleAssignees.length > 0 && (
          <div className="flex items-center -space-x-1.5 shrink-0">
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
                  className="h-5 w-5 ring-1 ring-background shrink-0"
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
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-background">
                +{extraAssignees}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="mb-2.5 line-clamp-2 pl-3 text-[13px] font-medium leading-snug text-foreground">
        {issue.title}
      </h4>

      {/* Labels */}
      {visibleLabels.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1 pl-3">
          {visibleLabels.map((label) => (
            <span key={label} className="chip">
              {label}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="text-[11px] text-muted-foreground">
              +{extraLabels}
            </span>
          )}
        </div>
      )}

      {/* Footer meta */}
      {hasFooter && (
        <div className="mt-1 flex items-center gap-2.5 border-t border-border/40 pt-2 pl-3">
          {issue.subtaskCount !== undefined && issue.subtaskCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="tabular-nums">{issue.subtaskDone ?? 0}/{issue.subtaskCount}</span>
            </div>
          )}

          {issue.commentCount !== undefined && issue.commentCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="tabular-nums">{issue.commentCount}</span>
            </div>
          )}

          {issue.attachmentCount !== undefined && issue.attachmentCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              <span className="tabular-nums">{issue.attachmentCount}</span>
            </div>
          )}

          {issue.dueDate && (
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date(issue.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
