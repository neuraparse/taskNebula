'use client';

import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { MessageSquare, Paperclip } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

interface KanbanCardProps {
  issue: {
    id: string;
    title: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignee?: {
      name: string;
      avatar: string;
    };
    labels?: string[];
    commentCount?: number;
    attachmentCount?: number;
  };
  draggableId?: string;
  onClick?: () => void;
}

const priorityColors = {
  low: 'border-l-slate-400',
  medium: 'border-l-blue-500',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500',
  none: 'border-l-gray-300',
};

export function KanbanCard({ issue, draggableId, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId || issue.id,
    disabled: !draggableId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click when dragging
    if (isDragging) {
      e.preventDefault();
      return;
    }
    onClick?.();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(isDragging && 'opacity-50')}
    >
      <div
        onClick={handleClick}
        className={cn(
          'group cursor-pointer rounded-lg border border-l-[3px] bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/50 hover:scale-[1.02]',
          priorityColors[issue.priority as keyof typeof priorityColors] || priorityColors.none
        )}
      >
        {/* Issue ID & Assignee */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-mono text-muted-foreground font-semibold tracking-tight">{issue.id}</span>
          {issue.assignee && (
            <Avatar className="h-6 w-6 ring-2 ring-background shadow-sm">
              <AvatarImage src={`https://avatar.vercel.sh/${issue.assignee.name}`} />
              <AvatarFallback className="text-[10px] bg-primary/10 font-semibold">{issue.assignee.avatar}</AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Title */}
        <h4 className="mb-2 text-sm font-medium leading-snug line-clamp-2 tracking-tight">
          {issue.title}
        </h4>

        {/* Labels */}
        {issue.labels && issue.labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {issue.labels.slice(0, 3).map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                {label}
              </Badge>
            ))}
            {issue.labels.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{issue.labels.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer */}
        {(issue.commentCount || issue.attachmentCount) && (
          <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground pt-1 border-t">
            {issue.commentCount !== undefined && issue.commentCount > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{issue.commentCount}</span>
              </div>
            )}
            {issue.attachmentCount !== undefined && issue.attachmentCount > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                <span>{issue.attachmentCount}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

