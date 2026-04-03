'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MessageSquare, Paperclip, Calendar, CheckCircle2, BookOpen, CheckSquare, Bug, Zap, FileText } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

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
    labels?: string[];
    commentCount?: number;
    attachmentCount?: number;
    dueDate?: string;
    subtaskCount?: number;
    subtaskDone?: number;
  };
  draggableId?: string;
  onClick?: () => void;
}

const priorityConfig: Record<KanbanCardProps['issue']['priority'], { color: string; ring: string; text: string }> = {
  critical: { color: 'bg-red-500', ring: 'ring-red-500/20', text: 'text-red-600 dark:text-red-400' },
  high: { color: 'bg-orange-500', ring: 'ring-orange-500/20', text: 'text-orange-600 dark:text-orange-400' },
  medium: { color: 'bg-blue-500', ring: 'ring-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  low: { color: 'bg-slate-400 dark:bg-slate-500', ring: 'ring-slate-400/20', text: 'text-slate-500 dark:text-slate-400' },
};

const typeConfig: Record<NonNullable<KanbanCardProps['issue']['type']>, { icon: React.ElementType; color: string }> = {
  story: { icon: BookOpen, color: 'text-emerald-500' },
  task: { icon: CheckSquare, color: 'text-blue-500' },
  bug: { icon: Bug, color: 'text-red-500' },
  epic: { icon: Zap, color: 'text-purple-500' },
};

export function KanbanCard({ issue, draggableId, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId || issue.id,
    disabled: !draggableId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    onClick?.();
  };

  const config = priorityConfig[issue.priority] || priorityConfig.medium;
  const tConfig = typeConfig[issue.type || 'task'] || typeConfig.task;
  const TypeIcon = tConfig.icon;
  const hasFooter = issue.commentCount || issue.attachmentCount || issue.dueDate || issue.subtaskCount;
  const issueKey = issue.key || issue.id;
  const assigneeInitials = issue.assignee?.name
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'kanban-card cursor-pointer select-none group/card',
        isDragging && 'opacity-50 shadow-xl scale-[1.03] rotate-[2deg]'
      )}
    >
      {/* Priority accent bar */}
      <div className={cn('absolute top-0 left-0 w-[3px] h-full rounded-l-lg', config.color)} />

      {/* Top: Type icon + Key + Assignee */}
      <div className="flex items-center justify-between gap-2 mb-2.5 pl-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', tConfig.color)} />
          <span className="text-[11px] font-mono font-medium text-muted-foreground">
            {issueKey}
          </span>
        </div>
        {issue.assignee && (
          <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
            <AvatarImage src={issue.assignee.avatar} alt={issue.assignee.name} />
            <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
              {assigneeInitials || '?'}
            </AvatarFallback>
            <span className="sr-only">{issue.assignee.name}</span>
          </Avatar>
        )}
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-medium leading-snug text-foreground line-clamp-2 mb-2 pl-1">
        {issue.title}
      </h4>

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5 pl-1">
          {issue.labels.slice(0, 2).map((label) => (
            <span
              key={label}
              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/8 text-primary/80 border border-primary/10"
            >
              {label}
            </span>
          ))}
          {issue.labels.length > 2 && (
            <span className="text-[10px] text-muted-foreground px-1 self-center">
              +{issue.labels.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Footer meta */}
      {hasFooter && (
        <div className="flex items-center gap-2.5 pt-2 mt-1 border-t border-border/30 pl-1">
          {issue.subtaskCount !== undefined && issue.subtaskCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              <span className="tabular-nums">{issue.subtaskDone || 0}/{issue.subtaskCount}</span>
            </div>
          )}

          {issue.commentCount !== undefined && issue.commentCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span className="tabular-nums">{issue.commentCount}</span>
            </div>
          )}

          {issue.attachmentCount !== undefined && issue.attachmentCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span className="tabular-nums">{issue.attachmentCount}</span>
            </div>
          )}

          {issue.dueDate && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
              <Calendar className="h-3 w-3" />
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
