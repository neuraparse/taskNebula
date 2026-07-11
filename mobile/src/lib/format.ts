/** Small presentation helpers shared across screens. */
import i18next from 'i18next';
import type { IssuePriority, IssueType } from '@/api/types';

type DateInput = Date | number | string | null | undefined;

function dateFromInput(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalizedDate(
  value: DateInput,
  fallback = '',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = dateFromInput(value);
  return date ? date.toLocaleDateString(i18next.language, options) : fallback;
}

export function formatLocalizedDateTime(
  value: DateInput,
  fallback = '',
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = dateFromInput(value);
  return date ? date.toLocaleString(i18next.language, options) : fallback;
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return i18next.t('time.justNow');
  if (min < 60) return i18next.t('time.minutesAgo', { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return i18next.t('time.hoursAgo', { count: hr });
  const d = Math.round(hr / 24);
  if (d < 30) return i18next.t('time.daysAgo', { count: d });
  return new Date(iso).toLocaleDateString(i18next.language);
}

export function initials(name?: string | null, email?: string): string {
  const base = name?.trim() || email?.split('@')[0] || '?';
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Tailwind text-color class per issue type (works in both themes). */
export const ISSUE_TYPE_COLOR: Record<IssueType, string> = {
  epic: 'text-purple-500',
  story: 'text-green-500',
  task: 'text-blue-500',
  bug: 'text-red-500',
  subtask: 'text-cyan-500',
};

export const PRIORITY_COLOR: Record<IssuePriority, string> = {
  none: 'text-muted-foreground',
  low: 'text-muted-foreground',
  medium: 'text-amber-500',
  high: 'text-orange-500',
  critical: 'text-red-500',
};
