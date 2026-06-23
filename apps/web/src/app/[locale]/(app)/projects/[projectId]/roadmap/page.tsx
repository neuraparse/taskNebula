'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lightbulb, ArrowDownUp } from 'lucide-react';
import { RoadmapLoadingShell } from './roadmap-loading-shell';

interface Epic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  targetDate: string | null;
}

interface ApiEpic {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  startDate?: string | null;
  createdAt?: string | null;
  targetDate?: string | null;
  dueDate?: string | null;
}

interface EpicsResponse {
  issues?: ApiEpic[];
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
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
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
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
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
      columns: [
        {
          label: `${monthAbbr(start.getMonth())} ${start.getDate()}`,
          start,
          end,
          isCurrent: true,
        },
      ],
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
    return {
      columns,
      totalDays: daysBetween(first.start, last.end),
      rangeStart: first.start,
      rangeEnd: last.end,
    };
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
    return {
      columns,
      totalDays: daysBetween(first.start, last.end),
      rangeStart: first.start,
      rangeEnd: last.end,
    };
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
  return {
    columns,
    totalDays: daysBetween(first.start, last.end),
    rangeStart: first.start,
    rangeEnd: last.end,
  };
}

/**
 * Compute bar position (left%, width%) within the visible period.
 * Returns null if the bar lies entirely outside the visible range.
 */
function computeBarPlacement(
  startDate: string | null,
  endDate: string | null,
  period: PeriodResult
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
  const t = useTranslations('pagesProjectTabs');
  const errorT = useTranslations('componentErrors.projects');
  const [epics, setEpics] = useState<Epic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodMode>('quarterly');
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const fetchEpics = async () => {
      try {
        const response = await fetch(`/api/issues?projectId=${projectId}&type=epic`);
        if (!response.ok) throw new Error(errorT('fetchEpics'));
        const data = (await response.json()) as EpicsResponse;
        const epicIssues = data.issues || [];
        const mapped: Epic[] = epicIssues.map((epic) => ({
          id: epic.id,
          title: epic.title,
          description: epic.description ?? null,
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
            title: t('roadmap.errorTitle'),
            description: t('roadmap.loadFailed'),
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
  }, [errorT, projectId, toast, t]);

  const periodData = useMemo(() => getPeriod(period), [period]);

  if (isLoading) {
    return <RoadmapLoadingShell />;
  }

  return (
    <div className="animate-fade-in flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <div className="border-border bg-background shrink-0 border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="text-accent-amber h-5 w-5" />
          <h1 className="text-xl font-semibold tracking-tight">{t('roadmap.title')}</h1>
        </div>
        <div className="mt-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodMode)}>
            <TabsList className="bg-muted rounded-full p-1">
              <TabsTrigger value="today" className="rounded-full px-4">
                {t('roadmap.period.today')}
              </TabsTrigger>
              <TabsTrigger value="weekly" className="rounded-full px-4">
                {t('roadmap.period.weekly')}
              </TabsTrigger>
              <TabsTrigger value="monthly" className="rounded-full px-4">
                {t('roadmap.period.monthly')}
              </TabsTrigger>
              <TabsTrigger value="quarterly" className="rounded-full px-4">
                {t('roadmap.period.quarterly')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Two-pane Layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left Pane: Initiatives list */}
        <aside className="border-border bg-background flex min-h-0 w-[320px] shrink-0 flex-col border-r">
          <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">
              {t('roadmap.title')}{' '}
              <span className="text-muted-foreground tabular-nums">{epics.length}</span>
            </p>
            <button
              type="button"
              className="text-muted-foreground hover:bg-accent/50 hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
              aria-label={t('roadmap.sortAriaLabel')}
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {epics.length === 0 ? (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                {t('roadmap.emptyList')}
              </div>
            ) : (
              <ul>
                {epics.map((epic) => (
                  <li key={epic.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/issues/${epic.id}`)}
                      className="hover:bg-accent/50 flex w-full items-center gap-2 px-4 text-left transition-colors"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <span className="shrink-0 text-base leading-none" aria-hidden>
                        {pickEmoji(epic.id)}
                      </span>
                      <span className="truncate text-sm">{epic.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right Pane: Gantt timeline */}
        <section className="bg-background min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <div className="min-w-[640px]">
            {/* Timeline header */}
            <div
              className="border-border bg-background sticky top-0 z-10 grid border-b"
              style={{
                gridTemplateColumns: `repeat(${periodData.columns.length}, minmax(0, 1fr))`,
              }}
            >
              {periodData.columns.map((col, idx) => (
                <div
                  key={idx}
                  className={`border-border flex items-center gap-2 border-r px-3 py-3 text-xs font-medium last:border-r-0 ${
                    col.isCurrent ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <span className="text-muted-foreground">{col.label}</span>
                  {col.isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      {t('roadmap.current')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Timeline body */}
            <div className="relative">
              {/* Column backgrounds (current month tint behind rows) */}
              <div
                className="pointer-events-none absolute inset-0 grid"
                style={{
                  gridTemplateColumns: `repeat(${periodData.columns.length}, minmax(0, 1fr))`,
                }}
                aria-hidden
              >
                {periodData.columns.map((col, idx) => (
                  <div
                    key={idx}
                    className={`border-border/60 border-r last:border-r-0 ${
                      col.isCurrent ? 'bg-blue-50/30' : ''
                    }`}
                  />
                ))}
              </div>

              {epics.length === 0 ? (
                <div
                  className="text-muted-foreground relative flex items-center justify-center text-sm"
                  style={{ height: ROW_HEIGHT_PX * 4 }}
                >
                  {t('roadmap.emptyTimeline')}
                </div>
              ) : (
                <ul className="relative">
                  {epics.map((epic) => {
                    const placement = computeBarPlacement(
                      epic.startDate,
                      epic.targetDate,
                      periodData
                    );
                    const palette = pickPalette(epic.id);
                    return (
                      <li
                        key={epic.id}
                        className="border-border/40 relative border-b"
                        style={{ height: ROW_HEIGHT_PX }}
                      >
                        {placement ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/issues/${epic.id}`)}
                            className={`absolute top-1/2 flex -translate-y-1/2 items-center rounded-full border ${palette.bg} ${palette.border} ${palette.text} shadow-xs ease-snap px-3 text-xs font-medium transition-transform duration-150 hover:scale-[1.01]`}
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
                          <div className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-xs italic">
                            {t('roadmap.noDatesSet')}
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
