'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
type RoadmapFormatter = ReturnType<typeof useFormatter>;

function getPeriod(
  mode: PeriodMode,
  formatter: RoadmapFormatter,
  today: Date = new Date()
): PeriodResult {
  const t = startOfDay(today);

  if (mode === 'today') {
    const start = t;
    const end = addDays(t, 1);
    return {
      columns: [
        {
          label: formatter.dateTime(start, { month: 'short', day: 'numeric' }),
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
        label: `${formatter.dateTime(s, {
          month: 'short',
          day: 'numeric',
        })}–${formatter.dateTime(addDays(e, -1), { month: 'short', day: 'numeric' })}`,
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
        label: formatter.dateTime(s, { month: 'short' }),
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
      label: formatter.dateTime(s, { month: 'short' }),
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

function statusDotClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('done') || normalized.includes('complete')) return 'status-live';
  if (normalized.includes('block') || normalized.includes('cancel')) return 'status-danger';
  if (normalized.includes('progress') || normalized.includes('active')) return 'status-live';
  return 'status-idle';
}

export default function RoadmapPage({ params }: RoadmapPageProps) {
  const { projectId } = use(params);
  const router = useRouter();
  const t = useTranslations('pagesProjectTabs');
  const formatter = useFormatter();
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

  const periodData = useMemo(() => getPeriod(period, formatter), [formatter, period]);

  if (isLoading) {
    return <RoadmapLoadingShell />;
  }

  return (
    <div className="animate-fade-in flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <div className="border-border bg-background shrink-0 border-b px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{t('roadmap.title')}</h1>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodMode)}>
            <TabsList>
              <TabsTrigger value="today">{t('roadmap.period.today')}</TabsTrigger>
              <TabsTrigger value="weekly">{t('roadmap.period.weekly')}</TabsTrigger>
              <TabsTrigger value="monthly">{t('roadmap.period.monthly')}</TabsTrigger>
              <TabsTrigger value="quarterly">{t('roadmap.period.quarterly')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Two-pane Layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left Pane: Initiatives list */}
        <aside className="border-border bg-background flex min-h-0 w-[240px] shrink-0 flex-col border-r sm:w-[280px] lg:w-[320px]">
          <div className="border-border flex shrink-0 items-center border-b px-4 py-3">
            <p className="text-sm font-semibold">
              {t('roadmap.title')}{' '}
              <span className="text-muted-foreground tabular-nums">{epics.length}</span>
            </p>
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
                      <span
                        className={`status-dot shrink-0 ${statusDotClass(epic.status)}`}
                        aria-hidden
                      />
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
                    col.isCurrent ? 'bg-accent-blue/5' : ''
                  }`}
                >
                  <span className="text-muted-foreground">{col.label}</span>
                  {col.isCurrent && (
                    <span className="bg-accent-blue/10 text-accent-blue inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium">
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
                      col.isCurrent ? 'bg-accent-blue/5' : ''
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
                            className="border-accent-blue/30 bg-accent-blue/15 text-foreground hover:bg-accent-blue/20 absolute top-1/2 flex -translate-y-1/2 items-center rounded-sm border px-3 text-xs font-medium transition-colors duration-150"
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
