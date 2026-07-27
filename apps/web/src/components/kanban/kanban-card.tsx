'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ViewTransition } from '@/components/ui/view-transition';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, MessageCircle, Paperclip, GitBranch } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

interface KanbanCardProps {
  issue: {
    id: string;
    key?: string;
    title: string;
    priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
    type?: 'task' | 'bug' | 'story' | 'epic';
    status?: string;
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
    /** True while an optimistic create is in flight (no server id yet). */
    optimistic?: boolean;
  };
  draggableId?: string;
  statusId?: string;
  issueId?: string;
  onClick?: () => void;
}

// --- Inline StatusIcon (self-contained fallback) ---
type StatusKind = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

function mapToKind(status?: string): StatusKind {
  const s = (status ?? '').toLowerCase().trim();
  if (s === 'backlog') return 'backlog';
  if (s === 'todo' || s === 'to do' || s === 'to-do') return 'todo';
  if (s === 'in progress' || s === 'in-progress' || s === 'inprogress' || s === 'doing')
    return 'in_progress';
  if (s === 'done' || s === 'completed' || s === 'complete') return 'done';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'todo';
}

const STATUS_COLOR: Record<StatusKind, string> = {
  backlog: 'text-muted-foreground',
  todo: 'text-muted-foreground',
  in_progress: 'text-accent-amber',
  done: 'text-accent-emerald',
  cancelled: 'text-accent-rose',
};

function InlineStatusIcon({ kind, size = 12 }: { kind: StatusKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={cn('shrink-0', STATUS_COLOR[kind])}
    >
      <circle
        cx="6"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={kind === 'done' ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

function InlineLabel({ label }: { label: string }) {
  return (
    <span className="bg-muted/70 text-muted-foreground inline-flex max-w-[140px] items-center truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium">
      {label}
    </span>
  );
}

type DueDescriptor =
  | { kind: 'overdue'; days: number; tone: 'danger' }
  | { kind: 'today'; tone: 'warn' }
  | { kind: 'tomorrow'; tone: 'warn' }
  | { kind: 'days'; days: number; tone: 'default' }
  | { kind: 'date'; label: string; tone: 'default' };

type KanbanFormatter = ReturnType<typeof useFormatter>;

function describeDue(
  due: string | null | undefined,
  formatter: KanbanFormatter
): DueDescriptor | null {
  if (!due) return null;
  const target = new Date(due);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const deltaDays = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
  if (deltaDays < 0) return { kind: 'overdue', days: Math.abs(deltaDays), tone: 'danger' };
  if (deltaDays === 0) return { kind: 'today', tone: 'warn' };
  if (deltaDays === 1) return { kind: 'tomorrow', tone: 'warn' };
  if (deltaDays < 7) return { kind: 'days', days: deltaDays, tone: 'default' };
  return {
    kind: 'date',
    label: formatter.dateTime(target, { month: 'short', day: 'numeric' }),
    tone: 'default',
  };
}

export function KanbanCard({ issue, draggableId, statusId, issueId, onClick }: KanbanCardProps) {
  const t = useTranslations('kanban');
  const formatter = useFormatter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: draggableId || issue.id,
    data: {
      type: 'card',
      statusId,
      issueId: issueId || draggableId || issue.id,
    },
    // Pending optimistic cards have no server id yet — not draggable.
    disabled: !draggableId || Boolean(issue.optimistic),
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
  const visibleAssignees = allAssignees.slice(0, 2);
  const extraAssignees = Math.max(0, allAssignees.length - visibleAssignees.length);

  const visibleLabels = (issue.labels ?? []).slice(0, 2);
  const extraLabels = Math.max(0, (issue.labels ?? []).length - visibleLabels.length);

  const due = describeDue(issue.dueDate, formatter);
  const dueLabel = (() => {
    if (!due) return null;
    switch (due.kind) {
      case 'overdue':
        return t('card.due.overdue', { days: due.days });
      case 'today':
        return t('card.due.today');
      case 'tomorrow':
        return t('card.due.tomorrow');
      case 'days':
        return t('card.due.inDays', { days: due.days });
      case 'date':
        return due.label;
    }
  })();
  const subtasks =
    typeof issue.subtaskCount === 'number' && issue.subtaskCount > 0
      ? { done: issue.subtaskDone ?? 0, total: issue.subtaskCount }
      : null;
  const comments = issue.commentCount ?? 0;
  const attachments = issue.attachmentCount ?? 0;
  const keyChip = issue.key ?? (draggableId ? null : issue.id);
  const statusKind = mapToKind(issue.status);
  const isUrgent = issue.priority === 'urgent' || issue.priority === 'critical';

  const hasTopRow = Boolean(keyChip || issue.type || issue.status);
  const hasLabels = visibleLabels.length > 0;
  const hasFooter =
    visibleAssignees.length > 0 || due || subtasks || comments > 0 || attachments > 0;

  // FEAT-31: name this card with a stable id so the browser can morph the
  // card into the issue detail header on navigation. Only opt in for cards
  // with a real issue id (skeleton drag overlays use placeholder ids).
  const transitionName = issueId ? `issue-${issueId}` : undefined;

  return (
    <ViewTransition name={transitionName}>
      <div
        ref={setNodeRef}
        style={style}
        data-dragging={isDragging ? 'true' : undefined}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        aria-busy={issue.optimistic ? true : undefined}
        className={cn(
          'kanban-card group/card touch-manipulation select-none py-3.5 pl-4',
          isDragging ? 'opacity-40 [&_*]:pointer-events-none' : 'cursor-grab',
          // Pending optimistic create: dim + non-interactive until the server row lands.
          issue.optimistic && 'pointer-events-none animate-pulse opacity-60'
        )}
      >
        {/* Priority indicator bar — left edge, full height */}
        <div
          className={cn(
            'priority-indicator absolute bottom-0 left-0 top-0 w-1',
            (issue.priority === 'critical' || issue.priority === 'urgent') && 'priority-critical',
            issue.priority === 'high' && 'priority-high',
            issue.priority === 'medium' && 'priority-medium',
            issue.priority === 'low' && 'priority-low'
          )}
        />

        {isUrgent ? <span className="sr-only">{t('card.urgentPriority')}</span> : null}

        {/* Top row: status icon + issue key + type */}
        {hasTopRow && (
          <div className="mb-2 flex items-center gap-1.5">
            <InlineStatusIcon kind={statusKind} size={12} />
            {keyChip && (
              <span className="text-muted-foreground font-mono text-[10px] font-medium tracking-tight">
                {keyChip}
              </span>
            )}
            {issue.type ? (
              <>
                <span className="text-muted-foreground/40" aria-hidden>
                  ·
                </span>
                <span className="text-muted-foreground text-[10px] capitalize">{issue.type}</span>
              </>
            ) : null}
            {issue.status && !issue.type ? (
              <span className="text-muted-foreground truncate text-[10px]">{issue.status}</span>
            ) : null}
          </div>
        )}

        {/* Title */}
        <h4 className="text-foreground line-clamp-2 text-[13.5px] font-medium leading-snug">
          {issue.title}
        </h4>

        {/* Labels stay neutral so status and priority retain semantic color. */}
        {hasLabels && (
          <div className="mt-2.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
            {visibleLabels.map((label) => (
              <InlineLabel key={label} label={label} />
            ))}
            {extraLabels > 0 && (
              <span className="text-muted-foreground shrink-0 text-[11px] font-medium tabular-nums">
                +{extraLabels}
              </span>
            )}
          </div>
        )}

        {/* Footer: due + subtasks + comments + attachments + assignees */}
        {hasFooter && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-[11.5px]">
              {due && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 tabular-nums',
                    due.tone === 'warn' && 'text-accent-amber',
                    due.tone === 'danger' && 'text-accent-rose'
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
                  {dueLabel}
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
              <div className="flex shrink-0 -space-x-1.5">
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
                      className="ring-card h-5 w-5 shrink-0 rounded-full ring-2"
                      title={a.name}
                    >
                      <span className="sr-only">{a.name}</span>
                      <AvatarImage src={a.avatar} alt={a.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                        {initials || '?'}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
                {extraAssignees > 0 && (
                  <span
                    className="ring-card bg-muted text-muted-foreground flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ring-2"
                    title={t('card.moreAssignees', { count: extraAssignees })}
                  >
                    +{extraAssignees}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ViewTransition>
  );
}
