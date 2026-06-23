'use client';

/**
 * notification-visuals.tsx
 * ------------------------
 * Centralized visual vocabulary for notifications. Every rendering spot
 * (bell dropdown, inbox row, detail panel, toast) should pull icons, tones,
 * chips, and relative-time formatting from this file so the product speaks
 * with one voice.
 *
 * Framework-agnostic: no data fetching, no hooks into notification state.
 * Pure presentation.
 */

import type { ComponentType, SVGProps } from 'react';
import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  isValid,
} from 'date-fns';
import {
  Activity,
  Archive,
  AtSign,
  BarChart3,
  Bell,
  CheckCircle2,
  Flag,
  FolderPlus,
  MessageSquare,
  Plus,
  UserCheck,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type NotificationTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export type NotificationIconSize = 'sm' | 'md';

export type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Known notification types. We keep this open (string index) so callers can
 * pass unknown types safely — they fall back to the `default` visuals.
 */
export type NotificationType =
  | 'assignment'
  | 'mention'
  | 'comment'
  | 'status_change'
  | 'issue_created'
  | 'sprint_started'
  | 'sprint_completed'
  | 'project_created'
  | 'project_archived'
  | 'digest'
  | 'default';

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Icon map keyed by notification type. `default` is the guaranteed fallback
 * used when an unknown type is passed. Keep additions here in sync with
 * `NOTIFICATION_TONES` so every type resolves to both an icon and a color.
 */
export const NOTIFICATION_ICONS: Readonly<Record<NotificationType, LucideIcon>> = {
  assignment: UserCheck,
  mention: AtSign,
  comment: MessageSquare,
  status_change: Activity,
  issue_created: Plus,
  sprint_started: Flag,
  sprint_completed: CheckCircle2,
  project_created: FolderPlus,
  project_archived: Archive,
  digest: BarChart3,
  default: Bell,
};

/* -------------------------------------------------------------------------- */
/*  Tones                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Semantic tone per notification type. Tones drive both the chip color and
 * the tinted background of `<NotificationIconBadge />`.
 */
export const NOTIFICATION_TONES: Readonly<Record<NotificationType, NotificationTone>> = {
  assignment: 'brand',
  mention: 'brand',
  comment: 'info',
  status_change: 'info',
  issue_created: 'brand',
  sprint_started: 'warning',
  sprint_completed: 'success',
  project_created: 'success',
  project_archived: 'neutral',
  digest: 'info',
  default: 'neutral',
};

/* -------------------------------------------------------------------------- */
/*  Resolvers                                                                 */
/* -------------------------------------------------------------------------- */

export function getNotificationIcon(type: string): LucideIcon {
  return NOTIFICATION_ICONS[type as NotificationType] ?? NOTIFICATION_ICONS.default;
}

export function getNotificationTone(type: string): NotificationTone {
  return NOTIFICATION_TONES[type as NotificationType] ?? NOTIFICATION_TONES.default;
}

/* -------------------------------------------------------------------------- */
/*  Tone → tailwind class tables                                              */
/* -------------------------------------------------------------------------- */

/**
 * Badge (circle) tint classes. Read badge = unread + slight ring reinforcement
 * so the icon reads stronger when a notification is new.
 */
const TONE_BADGE_BASE: Record<NotificationTone, string> = {
  brand: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  neutral: 'bg-muted text-muted-foreground',
};

const TONE_BADGE_UNREAD_RING: Record<NotificationTone, string> = {
  brand: 'ring-1 ring-indigo-500/30',
  info: 'ring-1 ring-sky-500/30',
  success: 'ring-1 ring-emerald-500/30',
  warning: 'ring-1 ring-amber-500/30',
  danger: 'ring-1 ring-rose-500/30',
  neutral: 'ring-1 ring-border',
};

/**
 * Chip class per tone — maps to existing design-system chip utilities in
 * `globals.css`. `brand` uses `chip-violet` (our indigo-violet primary).
 */
const TONE_CHIP: Record<NotificationTone, string> = {
  brand: 'chip-violet',
  info: 'chip-blue',
  success: 'chip-emerald',
  warning: 'chip-amber',
  danger: 'chip-rose',
  neutral: 'chip',
};

/* -------------------------------------------------------------------------- */
/*  <NotificationIconBadge />                                                 */
/* -------------------------------------------------------------------------- */

export interface NotificationIconBadgeProps {
  type: string;
  unread?: boolean;
  size?: NotificationIconSize;
  className?: string;
}

const BADGE_SIZE: Record<NotificationIconSize, string> = {
  sm: 'h-7 w-7', // 28px
  md: 'h-9 w-9', // 36px
};

const BADGE_ICON_SIZE: Record<NotificationIconSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
};

/**
 * Circular tinted tile with the type's icon. Use next to an avatar for
 * actor-driven notifications, or standalone for system notifications
 * (digests, sprint lifecycle, project events).
 */
export function NotificationIconBadge({
  type,
  unread = false,
  size = 'md',
  className,
}: NotificationIconBadgeProps) {
  const Icon = getNotificationIcon(type);
  const tone = getNotificationTone(type);

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        BADGE_SIZE[size],
        TONE_BADGE_BASE[tone],
        unread && TONE_BADGE_UNREAD_RING[tone],
        className
      )}
    >
      <Icon className={BADGE_ICON_SIZE[size]} />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  <NotificationTypeChip />                                                  */
/* -------------------------------------------------------------------------- */

export interface NotificationTypeChipProps {
  type: string;
  label?: string;
  className?: string;
}

/**
 * Compact chip carrying the notification's type icon + short label. Uses
 * existing `chip-*` utilities from `globals.css` so it auto-inherits
 * light/dark theming and border tokens.
 */
export function NotificationTypeChip({ type, label, className }: NotificationTypeChipProps) {
  const Icon = getNotificationIcon(type);
  const tone = getNotificationTone(type);
  const resolvedLabel = label ?? type;

  return (
    <span className={cn(TONE_CHIP[tone], 'rounded-sm', className)}>
      <Icon className="h-3 w-3" />
      <span>{resolvedLabel}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Time formatting                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Relative time for notification lists.
 * Pass the app's next-intl formatter/labels from the caller so this helper
 * never emits hardcoded English.
 */
export interface NotificationTimeFormatter {
  relativeTime?: (date: Date, options?: { style?: 'long' | 'short' | 'narrow' }) => string;
  dateTime?: (
    date: Date,
    options?: {
      month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
      day?: 'numeric' | '2-digit';
      year?: 'numeric' | '2-digit';
    }
  ) => string;
}

export function formatNotificationTime(
  date: Date | string,
  options: {
    formatter?: NotificationTimeFormatter;
    labels?: { now?: string; yesterday?: string };
  } = {}
): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(target)) return '';

  const { formatter, labels } = options;
  const now = new Date();
  const seconds = differenceInSeconds(now, target);

  if (seconds < 60)
    return labels?.now ?? formatter?.relativeTime?.(target, { style: 'narrow' }) ?? '';

  const minutes = differenceInMinutes(now, target);
  if (minutes < 60) return formatter?.relativeTime?.(target, { style: 'narrow' }) ?? '';

  const hours = differenceInHours(now, target);
  if (hours < 24) return formatter?.relativeTime?.(target, { style: 'narrow' }) ?? '';

  const days = differenceInCalendarDays(now, target);
  if (days === 1 && labels?.yesterday) return labels.yesterday;
  if (days < 7) return formatter?.relativeTime?.(target, { style: 'narrow' }) ?? '';

  const sameYear = target.getFullYear() === now.getFullYear();
  return (
    formatter?.dateTime?.(target, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    }) ?? ''
  );
}
