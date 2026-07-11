export type RoadmapPeriodMode = 'today' | 'weekly' | 'monthly' | 'quarterly';

export interface RoadmapPeriodColumn {
  start: Date;
  end: Date;
  isCurrent: boolean;
}

export interface RoadmapPeriod {
  columns: RoadmapPeriodColumn[];
  rangeStart: Date;
  rangeEnd: Date;
  totalDays: number;
}

export interface RoadmapPlacement {
  left: number;
  width: number;
}

export interface RoadmapIssueSource {
  createdAt?: string;
  dueDate?: string | null;
  customFields?: Record<string, unknown> | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(left: Date, right: Date): number {
  return Math.round((startOfDay(right).getTime() - startOfDay(left).getTime()) / MS_PER_DAY);
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const weekday = next.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(next, offset);
}

function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function periodFromColumns(columns: RoadmapPeriodColumn[]): RoadmapPeriod {
  const first = columns[0]!;
  const last = columns[columns.length - 1]!;
  return {
    columns,
    rangeStart: first.start,
    rangeEnd: last.end,
    totalDays: daysBetween(first.start, last.end) || 1,
  };
}

export function getRoadmapPeriod(mode: RoadmapPeriodMode, today = new Date()): RoadmapPeriod {
  const current = startOfDay(today);

  if (mode === 'today') {
    const start = current;
    const end = addDays(start, 1);
    return periodFromColumns([{ start, end, isCurrent: true }]);
  }

  if (mode === 'weekly') {
    const weekStart = startOfWeek(current);
    return periodFromColumns(
      Array.from({ length: 4 }, (_, index) => {
        const start = addDays(weekStart, index * 7);
        const end = addDays(start, 7);
        return { start, end, isCurrent: current >= start && current < end };
      }),
    );
  }

  if (mode === 'monthly') {
    const year = current.getFullYear();
    const month = current.getMonth();
    return periodFromColumns(
      Array.from({ length: 6 }, (_, index) => {
        const offset = index - 2;
        const start = new Date(year, month + offset, 1);
        const end = new Date(year, month + offset + 1, 1);
        return { start, end, isCurrent: isSameMonth(start, current) };
      }),
    );
  }

  const year = current.getFullYear();
  const firstQuarterMonth = Math.floor(current.getMonth() / 3) * 3;
  return periodFromColumns(
    Array.from({ length: 3 }, (_, index) => {
      const start = new Date(year, firstQuarterMonth + index, 1);
      const end = new Date(year, firstQuarterMonth + index + 1, 1);
      return { start, end, isCurrent: isSameMonth(start, current) };
    }),
  );
}

function parseRoadmapDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

export function computeRoadmapPlacement(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  period: RoadmapPeriod,
): RoadmapPlacement | null {
  const start = parseRoadmapDate(startDate);
  const end = parseRoadmapDate(endDate);
  if (!start || !end) return null;

  const exclusiveEnd = addDays(end, 1);
  if (exclusiveEnd <= period.rangeStart || start >= period.rangeEnd) return null;

  const clippedStart = start < period.rangeStart ? period.rangeStart : start;
  const clippedEnd = exclusiveEnd > period.rangeEnd ? period.rangeEnd : exclusiveEnd;
  const startOffset = daysBetween(period.rangeStart, clippedStart);
  const duration = daysBetween(clippedStart, clippedEnd);

  const left = Math.min(100, Math.max(0, (startOffset / period.totalDays) * 100));
  const unclampedWidth = Math.max(4, (duration / period.totalDays) * 100);
  const width = Math.min(unclampedWidth, Math.max(4, 100 - left));

  return { left, width };
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function roadmapStartDate(issue: RoadmapIssueSource): string | null {
  return stringField(issue.customFields?.startDate) ?? issue.createdAt ?? null;
}

export function roadmapEndDate(issue: RoadmapIssueSource): string | null {
  return stringField(issue.customFields?.targetDate) ?? issue.dueDate ?? null;
}
