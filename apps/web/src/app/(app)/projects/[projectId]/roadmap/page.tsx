'use client';

import { use, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

const PRIORITY_COLORS = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#6B7280',
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

      // Calculate progress for each epic
      const epicsWithProgress = data.map((epic: any) => ({
        id: epic.id,
        title: epic.title,
        description: epic.description,
        status: epic.status,
        priority: epic.priority,
        startDate: epic.startDate,
        dueDate: epic.dueDate,
        totalIssues: epic.childIssues?.length || 0,
        completedIssues: epic.childIssues?.filter((i: any) => i.status === 'done').length || 0,
        progress: epic.childIssues?.length
          ? Math.round((epic.childIssues.filter((i: any) => i.status === 'done').length / epic.childIssues.length) * 100)
          : 0,
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <MapPin className="h-8 w-8" />
                Epic Roadmap
              </h1>
              <p className="text-muted-foreground">
                Timeline view of your project epics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentYear(currentYear - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold w-20 text-center">{currentYear}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentYear(currentYear + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">

        {/* Roadmap Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline View</CardTitle>
            <CardDescription>
              Visual representation of epic timelines throughout the year
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Month Headers */}
            <div className="grid grid-cols-12 gap-1 mb-4">
              {MONTHS.map((month, idx) => (
                <div
                  key={idx}
                  className="text-center text-xs font-semibold text-muted-foreground p-2 border-b"
                >
                  {month.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Epic Bars */}
            <div className="space-y-3">
              {epics.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No epics found for this project</p>
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
                              className={`h-12 border ${
                                isInRange
                                  ? 'bg-primary/10 border-primary'
                                  : 'border-transparent'
                              } ${isStart ? 'rounded-l-md' : ''} ${isEnd ? 'rounded-r-md' : ''}`}
                            >
                              {isStart && (
                                <div className="p-1 text-xs truncate font-medium">
                                  {epic.title}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Progress Indicator */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
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
          </CardContent>
        </Card>

        {/* Epic List */}
        <div className="grid gap-4 md:grid-cols-2">
          {epics.map((epic) => (
            <Card key={epic.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{epic.title}</CardTitle>
                    {epic.description && (
                      <CardDescription className="mt-1">
                        {epic.description.slice(0, 100)}
                        {epic.description.length > 100 && '...'}
                      </CardDescription>
                    )}
                  </div>
                  <Badge
                    style={{
                      backgroundColor: PRIORITY_COLORS[epic.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low,
                    }}
                    className="text-white"
                  >
                    {epic.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{epic.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${epic.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{epic.completedIssues} of {epic.totalIssues} issues completed</span>
                    {epic.startDate && epic.dueDate && (
                      <span>
                        {new Date(epic.startDate).toLocaleDateString()} - {new Date(epic.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
