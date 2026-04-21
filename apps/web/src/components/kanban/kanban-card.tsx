'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, MessageCircle, Paperclip, GitBranch } from 'lucide-react';

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
    dueDate?: string | null;
    subtaskCount?: number;
    subtaskDone?: number;
  };
  draggableId?: string;
  statusId?: string;
  issueId?: string;
  onClick?: () => void;
}

const TYPE_CHIP: Record<NonNullable<KanbanCardProps['issue']['type']>, string> = {
  bug: 'chip-rose',
  story: 'chip-blue',
  epic: 'chip-violet',
  task: 'chip',
};

function formatDue(due?: string | null): { label: string; tone: 'default' | 'warn' | 'danger' } | null {
  if (!due) return null;
  const target = new Date(due);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const deltaDays = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
  if (deltaDays < 0) return { label: `${Math.abs(deltaDays)}d overdue`, tone: 'danger' };
  if (deltaDays === 0) return { label: 'Today', tone: 'warn' };
  if (deltaDays === 1) return { label: 'Tomorrow', tone: 'warn' };
  if (deltaDays < 7) return { label: `${deltaDays}d`, tone: 'default' };
  return {
    label: target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    tone: 'default',
  };
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

  const allAssignees = issue.assignees ?? (issue.assignee ? [issue.assignee] : []);
  const visibleAssignees = allAssignees.slice(0, 3);
  const extraAssignees = Math.max(0, allAssignees.length - visibleAssignees.length);

  const visibleLabels = (issue.labels ?? []).slice(0, 3);
  const extraLabels = Math.max(0, (issue.labels ?? []).length - visibleLabels.length);

  const due = formatDue(issue.dueDate);
  const subtasks =
    typeof issue.subtaskCount === 'number' && issue.subtaskCount > 0
      ? { done: issue.subtaskDone ?? 0, total: issue.subtaskCount }
      : null;
  const comments = issue.commentCount ?? 0;
  const attachments = issue.attachmentCount ?? 0;
  const typeChip = issue.type ? TYPE_CHIP[issue.type] : null;
  const keyChip = issue.key ?? (draggableId ? null : issue.id);

  const hasTopRow = Boolean(keyChip || typeChip);
  const hasLabels = visibleLabels.length > 0;
  const hasFooter =
    visibleAssignees.length > 0 || due || subtasks || comments > 0 || attachments > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging ? 'true' : undefined}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'kanban-card select-none touch-manipulation group/card pl-4 py-3.5',
        isDragging ? 'opacity-40 [&_*]:pointer-events-none' : 'cursor-grab'
      )}
    >
      {/* Priority indicator bar — left edge, full height */}
      <div
        className={cn(
          'priority-indicator absolute left-0 top-0 bottom-0 w-1',
          issue.priority === 'critical' && 'priority-critical',
          issue.priority === 'high' && 'priority-high',
          issue.priority === 'medium' && 'priority-medium',
          issue.priority === 'low' && 'priority-low'
        )}
      />

      {/* Top row: issue key + type */}
      {hasTopRow && (
        <div className="mb-2 flex items-center gap-1.5">
          {keyChip && (
            <span className="chip font-mono tracking-tight !text-[10px]">{keyChip}</span>
          )}
          {typeChip && issue.type && (
            <span className={cn(typeChip, 'capitalize')}>{issue.type}</span>
          )}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
        {issue.title}
      </h4>

      {/* Labels */}
      {hasLabels && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {visibleLabels.map((label) => (
            <span key={label} className="chip max-w-[140px] truncate">
              {label}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="chip tabular-nums">+{extraLabels}</span>
          )}
        </div>
      )}

      {/* Footer: due + subtasks + comments + attachments + assignees */}
      {hasFooter && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 text-[11px] text-muted-foreground">
            {due && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 tabular-nums',
                  due.tone === 'warn' && 'text-accent-amber',
                  due.tone === 'danger' && 'text-accent-rose'
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {due.label}
              </span>
            )}
            {subtasks && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <GitBranch className="h-3 w-3" />
                {subtasks.done}/{subtasks.total}
              </span>
            )}
            {comments > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MessageCircle className="h-3 w-3" />
                {comments}
              </span>
            )}
            {attachments > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Paperclip className="h-3 w-3" />
                {attachments}
              </span>
            )}
          </div>

          {visibleAssignees.length > 0 && (
            <div className="flex -space-x-1.5 shrink-0">
              {visibleAssignees.map((a) => {
                const initials = a.name
                  ?.split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <Avatar
                    key={a.name}
                    className="h-5 w-5 rounded-full ring-2 ring-card shrink-0"
                    title={a.name}
                  >
                    <AvatarImage src={a.avatar} alt={a.name} />
                    <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                      {initials || '?'}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {extraAssignees > 0 && (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card bg-muted text-[9px] font-semibold text-muted-foreground"
                  title={`+${extraAssignees} more`}
                >
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
