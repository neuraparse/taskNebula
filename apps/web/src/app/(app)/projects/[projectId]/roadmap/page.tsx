'use client';

import { use, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface Epic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  totalIssues: number;
  completedIssues: number;
}

interface RoadmapPageProps {
  params: Promise<{ projectId: string }>;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-accent-rose/10 text-accent-rose border-accent-rose/20',
  high: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
  medium: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  low: 'bg-muted text-muted-foreground border-border',
};

export default function RoadmapPage({ params }: RoadmapPageProps) {
  const { projectId } = use(params);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const { toast } = useToast();

  useEffect(() => {
    fetchEpics();
  }, [projectId]);

  const fetchEpics = async () => {
    try {
      const response = await fetch(`/api/issues?projectId=${projectId}&type=epic`);
      if (!response.ok) throw new Error('Failed to fetch epics');

      const data = await response.json();
      const epicIssues = data.issues || [];

      const epicsWithProgress = epicIssues.map((epic: any) => ({
        id: epic.id,
        title: epic.title,
        description: epic.description,
        status: epic.status,
        priority: epic.priority,
        startDate: epic.createdAt,
        dueDate: epic.dueDate,
        totalIssues: 0,
        completedIssues: 0,
        progress: epic.status === 'done' ? 100 : 0,
      }));

      setEpics(epicsWithProgress);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load epics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthPosition = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    if (d.getFullYear() !== currentYear) return null;
    return d.getMonth();
  };

  const getEpicDuration = (epic: Epic) => {
    if (!epic.startDate || !epic.dueDate) return null;

    const start = new Date(epic.startDate);
    const end = new Date(epic.dueDate);

    if (start.getFullYear() !== currentYear && end.getFullYear() !== currentYear) return null;

    const startMonth = start.getFullYear() === currentYear ? start.getMonth() : 0;
    const endMonth = end.getFullYear() === currentYear ? end.getMonth() : 11;

    return { start: startMonth, end: endMonth, span: endMonth - startMonth + 1 };
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading roadmap...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      {/* Fixed Header */}
      <div className="border-b border-border bg-background px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <span className="kicker">Project</span>
            <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
            <p className="text-sm text-muted-foreground">Timeline view of your project epics</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentYear(currentYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold w-16 text-center tabular-nums">{currentYear}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentYear(currentYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">

        {/* Roadmap Timeline */}
        <div className="surface-card p-5">
          <p className="text-sm font-semibold mb-1">Timeline</p>
          <p className="text-xs text-muted-foreground mb-4">Visual representation of epic timelines throughout the year</p>

          {/* Month Headers */}
          <div className="grid grid-cols-12 gap-1 mb-3">
            {MONTHS.map((month, idx) => (
              <div
                key={idx}
                className="text-center text-[10px] font-medium text-muted-foreground pb-1 border-b border-border"
              >
                {month.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Epic Bars */}
          <div className="space-y-3">
            {epics.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No epics found for this project</p>
              </div>
            ) : (
              epics.map((epic) => {
                const duration = getEpicDuration(epic);
                if (!duration) return null;

                return (
                  <div key={epic.id} className="relative">
                    <div className="grid grid-cols-12 gap-1">
                      {MONTHS.map((_, idx) => {
                        const isInRange = idx >= duration.start && idx <= duration.end;
                        const isStart = idx === duration.start;
                        const isEnd = idx === duration.end;

                        return (
                          <div
                            key={idx}
                            className={`h-10 border ${
                              isInRange
                                ? 'bg-primary/10 border-primary/30'
                                : 'border-transparent'
                            } ${isStart ? 'rounded-l-sm' : ''} ${isEnd ? 'rounded-r-sm' : ''}`}
                          >
                            {isStart && (
                              <div className="px-1.5 py-1 text-[11px] truncate font-medium text-primary">
                                {epic.title}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Progress Indicator */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden rounded-sm bg-primary/10">
                      <div
                        className="h-full rounded-sm bg-primary transition-all duration-150 ease-snap"
                        style={{
                          width: `${(epic.progress / 12) * duration.span * 100}%`,
                          marginLeft: `${(duration.start / 12) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Epic List */}
        <div className="stagger grid gap-3 md:grid-cols-2">
          {epics.map((epic) => (
            <div
              key={epic.id}
              className="surface-card surface-card-hover space-y-3 rounded-lg p-4 transition-all duration-150 ease-snap"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-snug">{epic.title}</p>
                <span className={`chip text-[10px] capitalize border ${PRIORITY_BADGE[epic.priority] ?? PRIORITY_BADGE.low}`}>
                  {epic.priority}
                </span>
              </div>
              {epic.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {epic.description}
                </p>
              )}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium tabular-nums">{epic.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-primary/10">
                  <div
                    className="h-full rounded-sm bg-primary transition-all duration-150 ease-snap"
                    style={{ width: `${epic.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{epic.completedIssues} of {epic.totalIssues} completed</span>
                  {epic.startDate && epic.dueDate && (
                    <span className="tabular-nums">
                      {new Date(epic.startDate).toLocaleDateString()} - {new Date(epic.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
