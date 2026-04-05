'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  GanttChartSquare,
  LayoutList,
  MoreHorizontal,
  Plus,
  Save,
  Settings2,
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import { BoardFiltersBar, DEFAULT_BOARD_FILTERS, type BoardFilters } from '@/components/kanban/board-filters';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIssues, type Issue } from '@/lib/hooks/use-issues';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ViewType = 'list' | 'board' | 'timeline' | 'calendar';
type ViewScope = 'personal' | 'project' | 'teamspace';

interface ProjectView {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  query: string;
  criteria: Record<string, any>;
  isPublic: boolean;
  isStarred: boolean;
  viewType: ViewType;
  lastUsedAt: string | null;
  updatedAt: string;
  scope: ViewScope;
  teamspaceId: string | null;
  isDefault: boolean;
  isOwned: boolean;
}

interface ProjectViewsResponse {
  viewerId: string;
  project: {
    id: string;
    key: string;
    name: string;
    teamId: string | null;
  };
  views: ProjectView[];
}

function filterIssues(issues: Issue[], filters: BoardFilters) {
  return issues.filter((issue) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        issue.title.toLowerCase().includes(searchLower) ||
        issue.key.toLowerCase().includes(searchLower) ||
        issue.description?.toLowerCase().includes(searchLower);

      if (!matchesSearch) {
        return false;
      }
    }

    if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
      return false;
    }

    return true;
  });
}

function normalizeFilters(criteria: Record<string, any> | null | undefined): BoardFilters {
  return {
    search: typeof criteria?.search === 'string' ? criteria.search : '',
    priority: Array.isArray(criteria?.priority) ? criteria.priority.filter(Boolean) : [],
    assignee: Array.isArray(criteria?.assignee) ? criteria.assignee.filter(Boolean) : [],
    labels: Array.isArray(criteria?.labels) ? criteria.labels.filter(Boolean) : [],
  };
}

function buildCriteria({
  filters,
  currentTeamId,
  activeViewType,
  scope,
  isDefault,
}: {
  filters: BoardFilters;
  currentTeamId: string | null;
  activeViewType: ViewType;
  scope: ViewScope;
  isDefault: boolean;
}) {
  return {
    search: filters.search,
    priority: filters.priority,
    assignee: filters.assignee,
    labels: filters.labels,
    scope,
    teamspaceId: scope === 'teamspace' ? currentTeamId : null,
    defaultView: isDefault,
    groupBy: activeViewType === 'board' ? 'status' : activeViewType === 'timeline' ? 'dueMonth' : null,
    visibleColumns: ['key', 'title', 'status', 'priority', 'assignee', 'dueDate'],
    sort: {
      field: activeViewType === 'calendar' ? 'dueDate' : 'updatedAt',
      direction: 'desc',
    },
  };
}

function getScopeLabel(scope: ViewScope) {
  if (scope === 'teamspace') {
    return 'Teamspace';
  }

  if (scope === 'personal') {
    return 'Personal';
  }

  return 'Project';
}

export function ProjectViewsShell({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const { toast } = useToast();
  const { data: teamspaces = [] } = useTeamspaces(currentOrganizationId);
  const [activeViewType, setActiveViewType] = useState<ViewType>('list');
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_BOARD_FILTERS);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewDescription, setViewDescription] = useState('');
  const [viewScope, setViewScope] = useState<ViewScope>(currentTeamId ? 'teamspace' : 'project');
  const [isPinnedView, setIsPinnedView] = useState(true);
  const [isDefaultView, setIsDefaultView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const hasAutoAppliedDefaultViewRef = useRef(false);

  const { data: issues = [], isLoading } = useIssues({ projectId });
  const { data: viewsData, isLoading: viewsLoading } = useQuery<ProjectViewsResponse>({
    queryKey: ['project-views', projectId, currentTeamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentTeamId) {
        params.set('teamId', currentTeamId);
      }

      const response = await fetch(
        `/api/projects/${projectId}/views${params.size ? `?${params.toString()}` : ''}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch project views');
      }
      return response.json();
    },
  });

  const activeTeamspace = useMemo(
    () => teamspaces.find((teamspace) => teamspace.id === currentTeamId) ?? null,
    [currentTeamId, teamspaces]
  );

  const visibleViews = useMemo(() => viewsData?.views ?? [], [viewsData?.views]);
  const defaultView = useMemo(
    () => visibleViews.find((view) => view.isDefault) ?? null,
    [visibleViews]
  );

  useEffect(() => {
    if (viewScope === 'teamspace' && !currentTeamId) {
      setViewScope('project');
    }
  }, [currentTeamId, viewScope]);

  useEffect(() => {
    hasAutoAppliedDefaultViewRef.current = false;
  }, [currentTeamId, projectId]);

  useEffect(() => {
    if (saveViewOpen) {
      setViewScope(currentTeamId ? 'teamspace' : 'project');
      setIsPinnedView(true);
      setIsDefaultView(false);
    }
  }, [currentTeamId, saveViewOpen]);

  const applyView = async (view: ProjectView) => {
    setActiveViewType(view.viewType);
    setFilters(normalizeFilters(view.criteria));

    await fetch(`/api/saved-filters/${view.id}/use`, { method: 'POST' }).catch(() => undefined);
  };

  useEffect(() => {
    if (hasAutoAppliedDefaultViewRef.current || !defaultView) {
      return;
    }

    hasAutoAppliedDefaultViewRef.current = true;
    void applyView(defaultView);
  }, [defaultView]);

  async function syncDefaultViews(scope: ViewScope, teamspaceId: string | null, excludeViewId?: string) {
    const sameScopeViews = visibleViews.filter((view) => {
      if (!view.isOwned || view.id === excludeViewId) {
        return false;
      }

      if (view.scope !== scope) {
        return false;
      }

      if (scope === 'teamspace') {
        return view.teamspaceId === teamspaceId;
      }

      return true;
    });

    await Promise.all(
      sameScopeViews
        .filter((view) => view.isDefault)
        .map((view) =>
          fetch(`/api/projects/${projectId}/views/${view.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isDefault: false }),
          })
        )
    );
  }

  const saveViewMutation = useMutation({
    mutationFn: async () => {
      if (isDefaultView) {
        await syncDefaultViews(viewScope, viewScope === 'teamspace' ? currentTeamId : null);
      }

      const response = await fetch(`/api/projects/${projectId}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: viewName.trim(),
          description: viewDescription.trim() || undefined,
          scope: viewScope,
          isPinned: isPinnedView,
          isDefault: isDefaultView,
          viewType: activeViewType,
          criteria: buildCriteria({
            filters,
            currentTeamId,
            activeViewType,
            scope: viewScope,
            isDefault: isDefaultView,
          }),
          query: `project = ${viewsData?.project.key ?? projectId}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save view');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-views', projectId, currentTeamId] });
      setSaveViewOpen(false);
      setViewName('');
      setViewDescription('');
      setViewScope(currentTeamId ? 'teamspace' : 'project');
      setIsPinnedView(true);
      setIsDefaultView(false);
      toast({
        title: 'View saved',
        description: 'This view is now reusable from the project header.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save view',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateViewMutation = useMutation({
    mutationFn: async ({
      viewId,
      payload,
    }: {
      viewId: string;
      payload: Record<string, any>;
    }) => {
      const response = await fetch(`/api/projects/${projectId}/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update view');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-views', projectId, currentTeamId] });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await fetch(`/api/projects/${projectId}/views/${viewId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete view');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-views', projectId, currentTeamId] });
    },
  });

  async function handleTogglePinned(view: ProjectView) {
    try {
      await updateViewMutation.mutateAsync({
        viewId: view.id,
        payload: { isPinned: !view.isStarred },
      });
    } catch (error) {
      toast({
        title: 'Failed to update view',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  async function handleToggleDefault(view: ProjectView) {
    try {
      if (!view.isDefault) {
        await syncDefaultViews(view.scope, view.teamspaceId, view.id);
      }

      await updateViewMutation.mutateAsync({
        viewId: view.id,
        payload: { isDefault: !view.isDefault },
      });
    } catch (error) {
      toast({
        title: 'Failed to update default view',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteView(view: ProjectView) {
    try {
      await deleteViewMutation.mutateAsync(view.id);
      toast({
        title: 'View deleted',
        description: `"${view.name}" was removed from this project.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to delete view',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  }

  const filteredIssues = useMemo(() => filterIssues(issues, filters), [filters, issues]);
  const scheduledIssues = useMemo(
    () =>
      filteredIssues
        .filter((issue) => issue.dueDate)
        .sort((left, right) => new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()),
    [filteredIssues]
  );
  const unscheduledIssues = useMemo(
    () => filteredIssues.filter((issue) => !issue.dueDate),
    [filteredIssues]
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const issuesByCalendarDay = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of scheduledIssues) {
      if (!issue.dueDate) continue;
      const key = format(parseISO(issue.dueDate), 'yyyy-MM-dd');
      const next = map.get(key) ?? [];
      next.push(issue);
      map.set(key, next);
    }
    return map;
  }, [scheduledIssues]);

  return (
    <>
      <div className="flex h-full flex-col bg-muted/[0.03]">
        <div className="shrink-0 border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h1 className="text-sm font-semibold">Views</h1>
                <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-wide">
                  {viewsData?.project.name || projectId}
                </Badge>
                {activeTeamspace ? (
                  <Badge variant="secondary" className="gap-1 rounded-none text-[10px] uppercase tracking-wide">
                    <Settings2 className="h-3 w-3" />
                    {activeTeamspace.name}
                  </Badge>
                ) : null}
                {defaultView ? (
                  <Badge variant="outline" className="rounded-none text-[10px] uppercase tracking-wide">
                    Default: {defaultView.name}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Unified planning surface for list, board, timeline, and calendar with reusable project and teamspace views.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-none"
                onClick={() => setSaveViewOpen(true)}
              >
                <Save className="h-3.5 w-3.5" />
                Save current view
              </Button>
              <Button size="sm" className="gap-1.5 rounded-none" onClick={() => setCreateIssueOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Issue
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <Tabs value={activeViewType} onValueChange={(value) => setActiveViewType(value as ViewType)}>
              <TabsList className="rounded-none bg-transparent p-0">
                <TabsTrigger value="list" className="gap-1.5 rounded-none border border-border/60 data-[state=active]:border-primary data-[state=active]:shadow-none">
                  <LayoutList className="h-4 w-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="board" className="gap-1.5 rounded-none border border-border/60 data-[state=active]:border-primary data-[state=active]:shadow-none">
                  <FolderKanban className="h-4 w-4" />
                  Board
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5 rounded-none border border-border/60 data-[state=active]:border-primary data-[state=active]:shadow-none">
                  <GanttChartSquare className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5 rounded-none border border-border/60 data-[state=active]:border-primary data-[state=active]:shadow-none">
                  <CalendarDays className="h-4 w-4" />
                  Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="min-w-0 flex-1 xl:max-w-3xl">
              <BoardFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                issueCount={issues.length}
                filteredCount={filteredIssues.length}
              />
            </div>
          </div>

          <div className="mt-3">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex items-center gap-2 pb-1">
                <Badge variant="secondary" className="rounded-none text-[10px] uppercase tracking-wide">
                  Saved Views
                </Badge>
                {viewsLoading ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : visibleViews.length ? (
                  visibleViews.map((view) => (
                    <div
                      key={view.id}
                      className={cn(
                        'inline-flex items-center gap-1 border bg-background pr-1 text-xs transition-colors',
                        activeViewType === view.viewType
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border/60 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <button
                        onClick={() => applyView(view)}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5"
                      >
                        <span>{view.name}</span>
                        {view.isStarred ? <Star className="h-3 w-3 fill-current" /> : null}
                        {view.isDefault ? <Target className="h-3 w-3" /> : null}
                        <Badge variant="outline" className="rounded-none px-1 text-[9px] uppercase">
                          {view.viewType}
                        </Badge>
                        <Badge variant="secondary" className="rounded-none px-1 text-[9px] uppercase">
                          {getScopeLabel(view.scope)}
                        </Badge>
                      </button>
                      {view.isOwned ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none"
                              aria-label={`Manage ${view.name}`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none">
                            <DropdownMenuItem onClick={() => void handleTogglePinned(view)}>
                              <Star className="mr-2 h-3.5 w-3.5" />
                              {view.isStarred ? 'Unpin view' : 'Pin view'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleToggleDefault(view)}>
                              <Target className="mr-2 h-3.5 w-3.5" />
                              {view.isDefault ? 'Clear default' : 'Set as default'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => void handleDeleteView(view)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete view
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Save a filtered view to make it reusable for this {currentTeamId ? 'teamspace' : 'project'} context.
                  </span>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Tabs value={activeViewType} onValueChange={(value) => setActiveViewType(value as ViewType)} className="flex min-h-0 flex-1 flex-col">
          <TabsContent value="list" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="overflow-hidden border border-border/60 bg-background">
                <div className="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_150px_150px] gap-3 border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Issue</span>
                  <span>Title</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Assignee</span>
                  <span>Due</span>
                </div>

                {isLoading ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">Loading issues…</div>
                ) : filteredIssues.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No issues match the current view.
                  </div>
                ) : (
                  filteredIssues.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className="grid w-full grid-cols-[120px_minmax(0,1fr)_120px_120px_150px_150px] gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                      <span className="truncate text-sm font-medium">{issue.title}</span>
                      <span className="text-xs text-muted-foreground">{issue.statusName || issue.status}</span>
                      <span className="text-xs capitalize text-muted-foreground">{issue.priority}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {issue.assignee?.name || issue.assignee?.email || 'Unassigned'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {issue.dueDate ? format(parseISO(issue.dueDate), 'MMM d, yyyy') : 'No due date'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="board" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <KanbanBoard projectId={projectId} filters={filters} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="border border-border/60 bg-background">
                  <div className="border-b bg-muted/30 px-4 py-3">
                    <h2 className="text-sm font-semibold">Scheduled Work</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ordered by due date to give us a lightweight timeline without replacing the roadmap.
                    </p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {scheduledIssues.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-muted-foreground">No scheduled issues in this view.</div>
                    ) : (
                      scheduledIssues.map((issue) => (
                        <button
                          key={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/20"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                              <Badge variant="outline" className="rounded-none text-[10px] capitalize">
                                {issue.priority}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm font-medium">{issue.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {issue.statusName || issue.status} · {issue.assignee?.name || issue.assignee?.email || 'Unassigned'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium">
                              {issue.dueDate ? format(parseISO(issue.dueDate), 'MMM d') : '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {issue.dueDate ? format(parseISO(issue.dueDate), 'yyyy') : ''}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="border border-border/60 bg-background">
                  <div className="border-b bg-muted/30 px-4 py-3">
                    <h2 className="text-sm font-semibold">Unscheduled</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issues still missing a target date.
                    </p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {unscheduledIssues.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-muted-foreground">Everything in this view is scheduled.</div>
                    ) : (
                      unscheduledIssues.map((issue) => (
                        <button
                          key={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{issue.title}</p>
                            <p className="text-xs text-muted-foreground">{issue.key}</p>
                          </div>
                          <Badge variant="secondary" className="rounded-none text-[10px]">
                            No due date
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="border border-border/60 bg-background">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold">{format(calendarMonth, 'MMMM yyyy')}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Due-date calendar for the current filtered dataset.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => setCalendarMonth((value) => subMonths(value, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => setCalendarMonth((value) => addMonths(value, 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 border-b bg-muted/20">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="border-r border-border/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayIssues = issuesByCalendarDay.get(key) ?? [];

                    return (
                      <div
                        key={key}
                        className={cn(
                          'min-h-36 border-r border-b border-border/40 px-3 py-2 last:border-r-0',
                          !isSameMonth(day, calendarMonth) && 'bg-muted/10 text-muted-foreground/50'
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              'text-xs font-medium',
                              isToday(day) && 'bg-primary px-1.5 py-0.5 text-primary-foreground'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {dayIssues.length ? (
                            <Badge variant="secondary" className="rounded-none text-[10px]">
                              {dayIssues.length}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          {dayIssues.slice(0, 3).map((issue) => (
                            <button
                              key={issue.id}
                              onClick={() => setSelectedIssueId(issue.id)}
                              className="w-full border border-border/60 bg-background px-2 py-1 text-left transition-colors hover:border-primary"
                            >
                              <p className="truncate text-[11px] font-medium">{issue.title}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{issue.key}</p>
                            </button>
                          ))}
                          {dayIssues.length > 3 ? (
                            <p className="text-[10px] text-muted-foreground">+{dayIssues.length - 3} more</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="rounded-none border-border/60">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              This stores the active view type and filters on top of the existing saved filters foundation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                View name
              </label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="Sprint planning board"
                className="rounded-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="view-description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="view-description"
                value={viewDescription}
                onChange={(event) => setViewDescription(event.target.value)}
                placeholder="Optional context for teammates"
                className="rounded-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="view-scope" className="text-sm font-medium">
                Scope
              </label>
              <Select value={viewScope} onValueChange={(value) => setViewScope(value as ViewScope)}>
                <SelectTrigger id="view-scope" className="rounded-none">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="teamspace" disabled={!currentTeamId}>
                    {currentTeamId ? `Teamspace${activeTeamspace ? ` · ${activeTeamspace.name}` : ''}` : 'Teamspace'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Personal views stay private. Project and Teamspace views are reusable by others in the same context.
              </p>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={isPinnedView} onCheckedChange={(checked) => setIsPinnedView(checked === true)} />
              Pin this view in the header
            </label>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={isDefaultView} onCheckedChange={(checked) => setIsDefaultView(checked === true)} />
              Apply this as the default view for the selected scope
            </label>

            {saveViewMutation.error ? (
              <div className="rounded-none bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveViewMutation.error.message}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)} className="rounded-none">
              Cancel
            </Button>
            <Button
              onClick={() => saveViewMutation.mutate()}
              disabled={!viewName.trim() || saveViewMutation.isPending}
              className="rounded-none"
            >
              {saveViewMutation.isPending ? 'Saving…' : 'Save view'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateIssueModal open={createIssueOpen} onOpenChange={setCreateIssueOpen} projectId={projectId} />

      {selectedIssueId ? (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => {
            if (!open) setSelectedIssueId(null);
          }}
        />
      ) : null}
    </>
  );
}
