'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lightbulb, ArrowDownUp } from 'lucide-react';

interface Epic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  targetDate: string | null;
}

interface RoadmapPageProps {
  params: Promise<{ projectId: string }>;
}

type PeriodMode = 'today' | 'weekly' | 'monthly' | 'quarterly';

interface PeriodColumn {
  label: string;
  start: Date;
  end: Date;
  isCurrent: boolean;
}

interface PeriodResult {
  columns: PeriodColumn[];
  totalDays: number;
  rangeStart: Date;
  rangeEnd: Date;
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Pastel palette for stable bar colours.
// Use light tints + darker text for readability.
const PASTEL_PALETTE = [
  { bg: 'bg-orange-200/70', text: 'text-orange-900', border: 'border-orange-300/60' }, // peach
  { bg: 'bg-purple-200/70', text: 'text-purple-900', border: 'border-purple-300/60' }, // lavender
  { bg: 'bg-yellow-200/70', text: 'text-yellow-900', border: 'border-yellow-300/60' }, // yellow
  { bg: 'bg-emerald-200/70', text: 'text-emerald-900', border: 'border-emerald-300/60' }, // emerald
  { bg: 'bg-blue-200/70', text: 'text-blue-900', border: 'border-blue-300/60' }, // blue
  { bg: 'bg-rose-200/70', text: 'text-rose-900', border: 'border-rose-300/60' }, // rose
];

// Deterministic emoji per initiative based on id hash.
const EMOJI_PALETTE = ['💡', '🚀', '🎯', '🌱', '⚡', '🔧', '📦', '🌟', '🛠️', '🧭'];

const ROW_HEIGHT_PX = 44;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

function startOfWeek(d: Date): Date {
  // Monday-start week.
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun .. 6=Sat
  const diff = (day === 0 ? -6 : 1 - day);
  return addDays(x, diff);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Compute the column structure + total day-span for a given period mode.
 * - quarterly: 3 months starting at the current quarter's first month
 * - monthly:   6 months centered on today (today's month is column 3, 0-indexed 2)
 * - weekly:    4 consecutive weeks starting this week (Mon)
 * - today:     a single day (today)
 */
function getPeriod(mode: PeriodMode, today: Date = new Date()): PeriodResult {
  const t = startOfDay(today);

  const monthAbbr = (i: number) => MONTH_ABBR[i] ?? '';

  if (mode === 'today') {
    const start = t;
    const end = addDays(t, 1);
    return {
      columns: [{
        label: `${monthAbbr(start.getMonth())} ${start.getDate()}`,
        start,
        end,
        isCurrent: true,
      }],
      totalDays: 1,
      rangeStart: start,
      rangeEnd: end,
    };
  }

  if (mode === 'weekly') {
    const weekStart = startOfWeek(t);
    const columns: PeriodColumn[] = [];
    for (let i = 0; i < 4; i++) {
      const s = addDays(weekStart, i * 7);
      const e = addDays(s, 7);
      columns.push({
        label: `Week of ${monthAbbr(s.getMonth())} ${s.getDate()}`,
        start: s,
        end: e,
        isCurrent: t >= s && t < e,
      });
    }
    const first = columns[0]!;
    const last = columns[columns.length - 1]!;
    return { columns, totalDays: daysBetween(first.start, last.end), rangeStart: first.start, rangeEnd: last.end };
  }

  if (mode === 'monthly') {
    // 6 months centered on today: today's month at index 2 → start = -2 months.
    const baseYear = t.getFullYear();
    const baseMonth = t.getMonth();
    const columns: PeriodColumn[] = [];
    for (let i = -2; i <= 3; i++) {
      const s = new Date(baseYear, baseMonth + i, 1);
      const e = new Date(baseYear, baseMonth + i + 1, 1);
      columns.push({
        label: monthAbbr(s.getMonth()),
        start: s,
        end: e,
        isCurrent: isSameMonth(s, t),
      });
    }
    const first = columns[0]!;
    const last = columns[columns.length - 1]!;
    return { columns, totalDays: daysBetween(first.start, last.end), rangeStart: first.start, rangeEnd: last.end };
  }

  // quarterly: current quarter (3 months)
  const baseYear = t.getFullYear();
  const quarterIndex = Math.floor(t.getMonth() / 3);
  const firstMonth = quarterIndex * 3;
  const columns: PeriodColumn[] = [];
  for (let i = 0; i < 3; i++) {
    const s = new Date(baseYear, firstMonth + i, 1);
    const e = new Date(baseYear, firstMonth + i + 1, 1);
    columns.push({
      label: monthAbbr(s.getMonth()),
      start: s,
      end: e,
      isCurrent: isSameMonth(s, t),
    });
  }
  const first = columns[0]!;
  const last = columns[columns.length - 1]!;
  return { columns, totalDays: daysBetween(first.start, last.end), rangeStart: first.start, rangeEnd: last.end };
}

/**
 * Compute bar position (left%, width%) within the visible period.
 * Returns null if the bar lies entirely outside the visible range.
 */
function computeBarPlacement(
  startDate: string | null,
  endDate: string | null,
  period: PeriodResult,
): { left: number; width: number } | null {
  if (!startDate || !endDate) return null;
  const s = startOfDay(new Date(startDate));
  const e = startOfDay(new Date(endDate));
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const eExclusive = addDays(e, 1); // treat end as inclusive
  if (eExclusive <= period.rangeStart || s >= period.rangeEnd) return null;

  const clippedStart = s < period.rangeStart ? period.rangeStart : s;
  const clippedEnd = eExclusive > period.rangeEnd ? period.rangeEnd : eExclusive;

  const startOffset = daysBetween(period.rangeStart, clippedStart);
  const duration = daysBetween(clippedStart, clippedEnd);

  const total = period.totalDays || 1;
  let left = (startOffset / total) * 100;
  let width = (duration / total) * 100;

  // Clamp.
  if (left < 0) left = 0;
  if (left > 100) left = 100;
  if (width < 4) width = 4; // ensure visibility
  if (left + width > 100) width = Math.max(4, 100 - left);

  return { left, width };
}

function pickPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PASTEL_PALETTE[hash % PASTEL_PALETTE.length] ?? PASTEL_PALETTE[0]!;
}

function pickEmoji(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 17 + id.charCodeAt(i)) >>> 0;
  }
  return EMOJI_PALETTE[hash % EMOJI_PALETTE.length] ?? '💡';
}

export default function RoadmapPage({ params }: RoadmapPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodMode>('quarterly');
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const fetchEpics = async () => {
      try {
        const response = await fetch(`/api/issues?projectId=${projectId}&type=epic`);
        if (!response.ok) throw new Error('Failed to fetch epics');
        const data = await response.json();
        const epicIssues = data.issues || [];
        const mapped: Epic[] = epicIssues.map((epic: any) => ({
          id: epic.id,
          title: epic.title,
          description: epic.description,
          status: epic.status,
          priority: epic.priority,
          // Treat createdAt as start (matches prior behaviour) and dueDate as targetDate.
          startDate: epic.startDate ?? epic.createdAt ?? null,
          targetDate: epic.targetDate ?? epic.dueDate ?? null,
        }));
        if (!cancelled) setEpics(mapped);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Error',
            description: 'Failed to load initiatives',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchEpics();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  const periodData = useMemo(() => getPeriod(period), [period]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading initiatives...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      {/* Page Header */}
      <div className="border-b border-border bg-background px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-accent-amber" />
          <h1 className="text-xl font-semibold tracking-tight">Initiatives</h1>
        </div>
        <div className="mt-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodMode)}>
            <TabsList className="rounded-full bg-muted p-1">
              <TabsTrigger value="today" className="rounded-full px-4">Today</TabsTrigger>
              <TabsTrigger value="weekly" className="rounded-full px-4">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="rounded-full px-4">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly" className="rounded-full px-4">Quarterly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Two-pane Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Pane: Initiatives list */}
        <aside className="w-[320px] shrink-0 border-r border-border bg-background flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <p className="text-sm font-semibold">
              Initiatives <span className="text-muted-foreground tabular-nums">{epics.length}</span>
            </p>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              aria-label="Sort initiatives"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {epics.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No initiatives yet
              </div>
            ) : (
              <ul>
                {epics.map((epic) => (
                  <li key={epic.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/issues/${epic.id}`)}
                      className="flex w-full items-center gap-2 px-4 text-left transition-colors hover:bg-accent/50"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <span className="text-base leading-none shrink-0" aria-hidden>
                        {pickEmoji(epic.id)}
                      </span>
                      <span className="text-sm truncate">{epic.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right Pane: Gantt timeline */}
        <section className="flex-1 overflow-x-auto overflow-y-auto bg-background min-h-0">
          <div className="min-w-[640px]">
            {/* Timeline header */}
            <div
              className="grid border-b border-border bg-background sticky top-0 z-10"
              style={{ gridTemplateColumns: `repeat(${periodData.columns.length}, minmax(0, 1fr))` }}
            >
              {periodData.columns.map((col, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-3 text-xs font-medium border-r border-border last:border-r-0 ${
                    col.isCurrent ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <span className="text-muted-foreground">{col.label}</span>
                  {col.isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Timeline body */}
            <div className="relative">
              {/* Column backgrounds (current month tint behind rows) */}
              <div
                className="absolute inset-0 grid pointer-events-none"
                style={{ gridTemplateColumns: `repeat(${periodData.columns.length}, minmax(0, 1fr))` }}
                aria-hidden
              >
                {periodData.columns.map((col, idx) => (
                  <div
                    key={idx}
                    className={`border-r border-border/60 last:border-r-0 ${
                      col.isCurrent ? 'bg-blue-50/30' : ''
                    }`}
                  />
                ))}
              </div>

              {epics.length === 0 ? (
                <div
                  className="relative flex items-center justify-center text-sm text-muted-foreground"
                  style={{ height: ROW_HEIGHT_PX * 4 }}
                >
                  No initiatives to display on the timeline
                </div>
              ) : (
                <ul className="relative">
                  {epics.map((epic) => {
                    const placement = computeBarPlacement(epic.startDate, epic.targetDate, periodData);
                    const palette = pickPalette(epic.id);
                    return (
                      <li
                        key={epic.id}
                        className="relative border-b border-border/40"
                        style={{ height: ROW_HEIGHT_PX }}
                      >
                        {placement ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/issues/${epic.id}`)}
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center rounded-full border ${palette.bg} ${palette.border} ${palette.text} px-3 text-xs font-medium shadow-xs transition-transform duration-150 ease-snap hover:scale-[1.01]`}
                            style={{
                              left: `${placement.left}%`,
                              width: `${placement.width}%`,
                              height: 24,
                            }}
                            title={epic.title}
                          >
                            <span className="truncate">{epic.title}</span>
                          </button>
                        ) : (
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground italic">
                            No dates set
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
