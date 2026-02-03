'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MessageSquare, Paperclip, Calendar, Flag, CheckCircle2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

interface KanbanCardProps {
  issue: {
    id: string;
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

const priorityConfig = {
  critical: { color: 'bg-red-500', label: 'Critical' },
  high: { color: 'bg-orange-500', label: 'High' },
  medium: { color: 'bg-blue-500', label: 'Medium' },
  low: { color: 'bg-slate-400 dark:bg-slate-500', label: 'Low' },
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
  const hasFooter = issue.commentCount || issue.attachmentCount || issue.dueDate || issue.subtaskCount;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'kanban-card cursor-pointer select-none',
        isDragging && 'opacity-60 shadow-lg scale-[1.02] rotate-1'
      )}
    >
      {/* Top Row: Key + Priority + Assignee */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono font-medium text-muted-foreground shrink-0">
            {issue.id}
          </span>
          {(issue.priority === 'critical' || issue.priority === 'high') && (
            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.color)} />
          )}
        </div>
        {issue.assignee && (
          <Avatar className="h-5 w-5 shrink-0 ring-1 ring-background">
            <AvatarImage src={`https://avatar.vercel.sh/${issue.assignee.name}`} />
            <AvatarFallback className="text-[9px] font-medium bg-muted text-muted-foreground">
              {issue.assignee.avatar}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-medium leading-[1.4] text-foreground line-clamp-2 mb-2">
        {issue.title}
      </h4>

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {issue.labels.slice(0, 2).map((label, idx) => (
            <span
              key={label}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {issue.labels.length > 2 && (
            <span className="text-[10px] text-muted-foreground px-1">
              +{issue.labels.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      {hasFooter && (
        <div className="flex items-center gap-3 pt-2 mt-1 border-t border-border/40">
          {/* Subtasks */}
          {issue.subtaskCount !== undefined && issue.subtaskCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              <span>{issue.subtaskDone || 0}/{issue.subtaskCount}</span>
            </div>
          )}

          {/* Comments */}
          {issue.commentCount !== undefined && issue.commentCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{issue.commentCount}</span>
            </div>
          )}

          {/* Attachments */}
          {issue.attachmentCount !== undefined && issue.attachmentCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{issue.attachmentCount}</span>
            </div>
          )}

          {/* Due Date */}
          {issue.dueDate && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(issue.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
