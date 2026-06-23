'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ViewTransition } from '@/components/ui/view-transition';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, CalendarDays, MessageCircle, Paperclip, GitBranch } from 'lucide-react';
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
  in_progress: 'text-amber-500',
  done: 'text-emerald-500',
  cancelled: 'text-rose-500',
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

// --- Inline LabelPill (self-contained fallback) ---
const LABEL_PALETTE = [
  'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/20',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20',
  'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20',
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function InlineLabelPill({ label, hashSeed }: { label: string; hashSeed?: string }) {
  const color = LABEL_PALETTE[hashString(hashSeed ?? label) % LABEL_PALETTE.length];
  return (
    <span
      className={cn(
        'inline-flex max-w-[140px] items-center truncate rounded-full px-2 py-0.5 text-[11.5px] font-medium',
        color
      )}
    >
      {label}
    </span>
  );
}

const TYPE_CHIP: Record<NonNullable<KanbanCardProps['issue']['type']>, string> = {
  bug: 'chip-rose',
  story: 'chip-blue',
  epic: 'chip-violet',
  task: 'chip',
};

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
  const visibleAssignees = allAssignees.slice(0, 3);
  const extraAssignees = Math.max(0, allAssignees.length - visibleAssignees.length);

  const visibleLabels = (issue.labels ?? []).slice(0, 3);
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
  const typeChip = issue.type ? TYPE_CHIP[issue.type] : null;
  const keyChip = issue.key ?? (draggableId ? null : issue.id);
  const statusKind = mapToKind(issue.status);
  const isUrgent = issue.priority === 'urgent' || issue.priority === 'critical';

  const hasTopRow = Boolean(keyChip || typeChip || issue.status);
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

        {/* Urgent priority indicator — top-right corner */}
        {isUrgent && (
          <AlertCircle
            className="absolute right-2 top-2 h-3.5 w-3.5 text-red-500"
            aria-label={t('card.urgentPriority')}
          />
        )}

        {/* Top row: status icon + issue key + type */}
        {hasTopRow && (
          <div className={cn('mb-2 flex items-center gap-1.5', isUrgent && 'pr-5')}>
            <InlineStatusIcon kind={statusKind} size={12} />
            {keyChip && (
              <span className="chip font-mono !text-[10px] tracking-tight">{keyChip}</span>
            )}
            {typeChip && issue.type && (
              <span className={cn(typeChip, 'capitalize')}>{issue.type}</span>
            )}
          </div>
        )}

        {/* Title */}
        <h4
          className={cn(
            'text-foreground line-clamp-2 text-[13.5px] font-medium leading-snug',
            !hasTopRow && isUrgent && 'pr-5'
          )}
        >
          {issue.title}
        </h4>

        {/* Labels */}
        {hasLabels && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {visibleLabels.map((label) => (
              <InlineLabelPill key={label} label={label} hashSeed={label} />
            ))}
            {extraLabels > 0 && (
              <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular-nums">
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
