'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { format, formatDistanceToNow } from 'date-fns';
import { Archive, Check, Clock, ExternalLink, Inbox, MoreHorizontal, Quote } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/lib/hooks/use-notifications';
import {
  NotificationAvatar,
  getActorName,
  resolveHref,
  resolveStackKey,
} from './notification-item';

export interface NotificationDetailPanelProps {
  notification: Notification | null;
  related: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onArchive?: (id: string) => void;
  onSnooze?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Type → human label + chip flavor (indigo / violet leaning by default)
// ---------------------------------------------------------------------------

type DetailTranslator = (key: string) => string;

/** Translation-key suffix (under `notifications.detail.type_label`) per type. */
const TYPE_LABEL_KEYS: Record<NotificationType, string> = {
  mention: 'mention',
  comment: 'comment',
  assigned: 'assigned',
  status_changed: 'status_changed',
  issue_created: 'issue_created',
  issue_updated: 'issue_updated',
  issue_linked: 'issue_linked',
  sprint_started: 'sprint_started',
  sprint_completed: 'sprint_completed',
  ai_draft_failed: 'ai_draft_failed',
  agent_run_failed: 'agent_run_failed',
  project_created: 'project_created',
  project_archived: 'project_archived',
};

function typeChipClass(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return 'chip-violet';
    case 'comment':
      return 'chip-blue';
    case 'assigned':
    case 'issue_linked':
      return 'chip-cyan';
    case 'status_changed':
    case 'issue_updated':
    case 'issue_created':
      return 'chip-violet';
    case 'sprint_started':
    case 'sprint_completed':
      return 'chip-emerald';
    case 'project_created':
      return 'chip-emerald';
    case 'project_archived':
      return 'chip';
    case 'ai_draft_failed':
    case 'agent_run_failed':
      return 'chip-rose';
    default:
      return 'chip';
  }
}

// ---------------------------------------------------------------------------
// Quote extraction — only if the message clearly contains a quoted snippet.
// We don't invent data; we only recognize patterns already present.
// ---------------------------------------------------------------------------

function extractQuote(notification: Notification): { quote: string; rest: string } | null {
  const msg = notification.message ?? '';
  if (!msg) return null;

  // Comment / mention surface the snippet as the body naturally.
  if (notification.type === 'comment' || notification.type === 'mention') {
    // If the message is wrapped in quotes, strip them for the callout.
    const trimmed = msg.trim();
    const quoted = trimmed.match(/^["“](.+)["”]$/s);
    const inner = quoted?.[1];
    if (inner) {
      return { quote: inner.trim(), rest: '' };
    }
    return { quote: trimmed, rest: '' };
  }

  // Generic inline >>> quote or leading "> " markdown-style quote line.
  const gtMatch = msg.match(/(^|\n)>\s?([^\n]+(?:\n>\s?[^\n]+)*)/);
  const gtInner = gtMatch?.[2];
  if (gtMatch && gtInner) {
    const quote = gtInner.replace(/\n>\s?/g, '\n').trim();
    const rest = msg.replace(gtMatch[0], '').trim();
    return { quote, rest };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Metadata rows — only include fields we actually have.
// ---------------------------------------------------------------------------

interface MetaRow {
  label: string;
  value: string;
  href?: string;
}

function buildMeta(notification: Notification, t: DetailTranslator): MetaRow[] {
  const rows: MetaRow[] = [];
  if (notification.projectId) {
    rows.push({
      label: t('detail.meta.project'),
      value: notification.projectId,
      href: `/projects/${notification.projectId}`,
    });
  }
  if (notification.issueId) {
    rows.push({
      label: t('detail.meta.issue'),
      value: notification.issueId,
      href: `/issues/${notification.issueId}`,
    });
  }
  if (notification.type === 'sprint_started' || notification.type === 'sprint_completed') {
    rows.push({
      label: t('detail.meta.sprint'),
      value: t(`detail.type_label.${TYPE_LABEL_KEYS[notification.type]}`),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  const t = useTranslations('notifications');
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-500 ring-1 ring-indigo-500/20"
        aria-hidden="true"
      >
        <Inbox className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t('detail.empty_title')}</p>
        <p className="text-muted-foreground max-w-[240px] text-xs">{t('detail.empty_hint')}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/**
 * Right pane detail view. Shows the selected notification with its full
 * message, entity metadata, and quick actions. On narrow widths the secondary
 * actions collapse into a kebab menu.
 */
export function NotificationDetailPanel({
  notification,
  related,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onSnooze,
}: NotificationDetailPanelProps) {
  const t = useTranslations('notifications');
  if (!notification) {
    return <EmptyState />;
  }

  const href = resolveHref(notification);
  const actor = getActorName(notification, t);
  const stackKey = resolveStackKey(notification);
  const history = related
    .filter((n) => (stackKey ? resolveStackKey(n) === stackKey : n.id === notification.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const typeLabelKey = TYPE_LABEL_KEYS[notification.type];
  const typeLabel = typeLabelKey ? t(`detail.type_label.${typeLabelKey}`) : notification.type;
  const typeChip = typeChipClass(notification.type);
  const createdAt = new Date(notification.createdAt);
  const relative = formatDistanceToNow(createdAt, { addSuffix: true });
  const absolute = format(createdAt, 'PP p');
  const quote = extractQuote(notification);
  const meta = buildMeta(notification, t);

  const markReadHandler = notification.isRead ? onMarkUnread : onMarkRead;
  const markReadLabel = notification.isRead ? t('detail.mark_unread') : t('detail.mark_read');

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      <header className="border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-start gap-3 border-b px-5 py-4 backdrop-blur">
        <div className="shrink-0">
          <NotificationAvatar notification={notification} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-foreground text-sm font-medium">{actor}</span>
            <span className={cn(typeChip, 'shrink-0 rounded-full')}>{typeLabel}</span>
          </div>
          <time
            className="text-muted-foreground mt-0.5 block text-xs"
            dateTime={createdAt.toISOString()}
            title={absolute}
          >
            {relative} &middot; {absolute}
          </time>
        </div>
      </header>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 px-5 py-5">
          {/* Title + body */}
          <section className="space-y-2">
            <h2 className="text-foreground text-base font-semibold leading-snug">
              {notification.title}
            </h2>
            {quote ? (
              <>
                {quote.rest && (
                  <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
                    {quote.rest}
                  </p>
                )}
                <blockquote className="bg-muted/40 text-foreground/85 relative rounded-sm border-l-2 border-indigo-500/60 py-3 pl-4 pr-3 text-sm italic">
                  <Quote
                    className="absolute -top-1.5 left-2 h-3 w-3 text-indigo-500/70"
                    aria-hidden="true"
                  />
                  <p className="whitespace-pre-wrap leading-relaxed">{quote.quote}</p>
                </blockquote>
              </>
            ) : notification.message ? (
              <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
                {notification.message}
              </p>
            ) : null}
          </section>

          {/* Metadata — compact key/value pairs */}
          {meta.length > 0 && (
            <section className="space-y-2">
              <h3 className="kicker text-[11px]">{t('detail.context')}</h3>
              <dl className="border-border/60 bg-muted/20 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md border px-3 py-2.5">
                {meta.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-muted-foreground text-xs">{row.label}</dt>
                    <dd className="text-foreground min-w-0 truncate text-xs font-medium">
                      {row.href ? (
                        <Link href={row.href} className="hover:text-indigo-500 hover:underline">
                          {row.value}
                        </Link>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Primary action */}
          {href && (
            <section>
              <Button
                asChild
                className="h-9 w-full gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:from-indigo-500/90 hover:to-violet-500/90 sm:w-auto"
              >
                <Link href={href}>
                  {t('detail.open_in_context')}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </section>
          )}

          {/* Secondary actions — visible on wider panels, kebab on narrow */}
          <section className="border-border/60 flex items-center justify-between gap-2 border-t pt-4">
            {/* Inline row: hidden on narrow, visible on sm+ */}
            <div className="hidden items-center gap-1 sm:flex">
              {markReadHandler && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
                  onClick={() => markReadHandler(notification.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  {markReadLabel}
                </Button>
              )}
              {onSnooze && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
                  onClick={() => onSnooze(notification.id)}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t('detail.snooze')}
                </Button>
              )}
              {onArchive && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
                  onClick={() => onArchive(notification.id)}
                >
                  <Archive className="h-3.5 w-3.5" />
                  {t('detail.dismiss')}
                </Button>
              )}
            </div>

            {/* Kebab menu — visible on narrow only */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="text-muted-foreground hover:text-foreground h-8 w-8"
                    aria-label={t('detail.more_actions')}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {markReadHandler && (
                    <DropdownMenuItem onSelect={() => markReadHandler(notification.id)}>
                      <Check className="mr-2 h-3.5 w-3.5" />
                      {markReadLabel}
                    </DropdownMenuItem>
                  )}
                  {onSnooze && (
                    <DropdownMenuItem onSelect={() => onSnooze(notification.id)}>
                      <Clock className="mr-2 h-3.5 w-3.5" />
                      {t('detail.snooze')}
                    </DropdownMenuItem>
                  )}
                  {onArchive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => onArchive(notification.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Archive className="mr-2 h-3.5 w-3.5" />
                        {t('detail.dismiss')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          {/* Activity history */}
          {history.length > 1 && (
            <section className="space-y-2">
              <h3 className="kicker text-[11px]">{t('detail.activity_heading')}</h3>
              <ul role="list" className="space-y-2">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-border/60 bg-muted/20 rounded-sm border px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-foreground text-xs font-medium">
                        {getActorName(entry, t)}
                      </p>
                      <time
                        className="text-muted-foreground/70 shrink-0 text-[10px] uppercase tracking-wide"
                        dateTime={new Date(entry.createdAt).toISOString()}
                      >
                        {formatDistanceToNow(new Date(entry.createdAt), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {entry.message || entry.title}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
