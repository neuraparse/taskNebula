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
  ChevronDown,
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
import { ViewFilterBar } from '@/components/issues/view-filter-bar';
import { ViewDisplayOptions } from '@/components/issues/view-display-options';
import { DEFAULT_DISPLAY_OPTIONS, defaultFilters, type DisplayOptions, type ViewFilter } from '@/lib/issues/view-state';
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
import { Avatar, AvatarFallback, AvatarImage, AvatarStack } from '@/components/ui/avatar';
import { useIssues, type Issue } from '@/lib/hooks/use-issues';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { useWorkflowStatuses, type WorkflowStatus } from '@/lib/hooks/use-workflow-statuses';
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
  const [viewFilters, setViewFilters] = useState<ViewFilter[]>(() => defaultFilters());
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
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
  const { data: workflowStatuses = [] } = useWorkflowStatuses(projectId);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
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

  const TRIAGE_GROUP_ID = '__triage__';

  const groupedListIssues = useMemo(() => {
    const orderedStatuses: Array<Pick<WorkflowStatus, 'id' | 'name' | 'color'>> = [];
    const seen = new Set<string>();

    // Triage group sits at the top for any issue without a workflow status mapping.
    orderedStatuses.push({ id: TRIAGE_GROUP_ID, name: 'Triage', color: '#94a3b8' });
    seen.add(TRIAGE_GROUP_ID);

    for (const status of workflowStatuses) {
      if (!seen.has(status.id)) {
        orderedStatuses.push({ id: status.id, name: status.name, color: status.color });
        seen.add(status.id);
      }
    }

    const buckets = new Map<string, Issue[]>();
    for (const status of orderedStatuses) {
      buckets.set(status.id, []);
    }

    for (const issue of filteredIssues) {
      const key = issue.statusId && buckets.has(issue.statusId) ? issue.statusId : TRIAGE_GROUP_ID;
      buckets.get(key)!.push(issue);
    }

    // Sort each bucket using the active list sort field (updatedAt desc, matching buildCriteria default).
    for (const [key, bucket] of buckets) {
      bucket.sort(
        (left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
      );
      buckets.set(key, bucket);
    }

    return orderedStatuses
      .map((status) => ({ status, issues: buckets.get(status.id) ?? [] }))
      // Keep the Triage group only when it has items to avoid empty noise at the top of mature projects.
      .filter((group) => group.status.id !== TRIAGE_GROUP_ID || group.issues.length > 0);
  }, [filteredIssues, workflowStatuses]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

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
      <div className="flex h-full flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-background px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {viewsData?.project.name || projectId}
              </h1>
              {activeTeamspace ? (
                <span className="chip gap-1">
                  <Settings2 className="h-3 w-3" />
                  {activeTeamspace.name}
                </span>
              ) : null}
              {defaultView ? (
                <span className="chip">Default: {defaultView.name}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveViewOpen(true)}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save view
              </Button>
              <Button size="sm" onClick={() => setCreateIssueOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Issue
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <Tabs value={activeViewType} onValueChange={(value) => setActiveViewType(value as ViewType)}>
              <TabsList className="h-8 bg-muted/30 p-0.5 rounded-md">
                <TabsTrigger value="list" className="gap-1.5 h-7 rounded-sm text-xs data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  <LayoutList className="h-3.5 w-3.5" />
                  List
                </TabsTrigger>
                <TabsTrigger value="board" className="gap-1.5 h-7 rounded-sm text-xs data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Board
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5 h-7 rounded-sm text-xs data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  <GanttChartSquare className="h-3.5 w-3.5" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5 h-7 rounded-sm text-xs data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
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

          {(activeViewType === 'list' || activeViewType === 'board') ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <ViewFilterBar filters={viewFilters} onChange={setViewFilters} />
              <ViewDisplayOptions options={displayOptions} onChange={setDisplayOptions} />
            </div>
          ) : null}

          <div className="mt-2">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex items-center gap-1.5 pb-1">
                <span className="kicker shrink-0">Views</span>
                {viewsLoading ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : visibleViews.length ? (
                  visibleViews.map((view) => (
                    <div
                      key={view.id}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border pr-1 text-xs transition-colors duration-150 ease-snap',
                        activeViewType === view.viewType
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      <button
                        onClick={() => applyView(view)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1"
                      >
                        <span>{view.name}</span>
                        {view.isStarred ? <Star className="h-3 w-3 fill-current" /> : null}
                        {view.isDefault ? <Target className="h-3 w-3" /> : null}
                        <span className="chip text-[9px]">{view.viewType}</span>
                        <span className="chip text-[9px]">{getScopeLabel(view.scope)}</span>
                      </button>
                      {view.isOwned ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-sm"
                              aria-label={`Manage ${view.name}`}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                    Save a view to reuse it across this {currentTeamId ? 'teamspace' : 'project'}.
                  </span>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Tabs value={activeViewType} onValueChange={(value) => setActiveViewType(value as ViewType)} className="flex min-h-0 flex-1 flex-col">
          <TabsContent value="list" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="overflow-hidden rounded-lg border border-border bg-card animate-fade-up">
                {isLoading ? (
                  <div className="px-4 py-8 text-sm text-muted-foreground">Loading issues…</div>
                ) : filteredIssues.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No issues match the current view.</p>
                    <Button size="sm" onClick={() => setCreateIssueOpen(true)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      New Issue
                    </Button>
                  </div>
                ) : (
                  <div className="stagger">
                    {groupedListIssues.map((group) => {
                      const isCollapsed = !!collapsedGroups[group.status.id];
                      const groupColor = group.status.color || '#94a3b8';

                      return (
                        <section key={group.status.id} className="border-b border-border/60 last:border-b-0">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.status.id)}
                            className={cn(
                              'sticky top-0 z-10 flex w-full items-center gap-2 border-b border-border/60 bg-background px-4 py-2 text-left',
                              'hover:bg-accent/40 transition-colors duration-150 ease-snap'
                            )}
                            aria-expanded={!isCollapsed}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span
                              aria-hidden="true"
                              className="inline-block h-2.5 w-2.5 rounded-full border"
                              style={{ backgroundColor: groupColor, borderColor: groupColor }}
                            />
                            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              {group.status.name}
                            </span>
                            <span className="text-xs text-muted-foreground">{group.issues.length}</span>
                          </button>

                          {!isCollapsed ? (
                            group.issues.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-muted-foreground">No items</div>
                            ) : (
                              <ul className="divide-y divide-border/60">
                                {group.issues.map((issue) => {
                                  const priorityKey = ['critical', 'high', 'medium', 'low'].includes(issue.priority)
                                    ? issue.priority
                                    : 'low';
                                  const dotColor = issue.statusColor || groupColor;
                                  const dueLabel = issue.dueDate ? format(parseISO(issue.dueDate), 'MMM d') : null;
                                  const assignees = issue.assignee ? [issue.assignee] : [];
                                  const labels = Array.isArray(issue.labels) ? issue.labels : [];

                                  return (
                                    <li key={issue.id} className="relative">
                                      <span
                                        aria-hidden="true"
                                        className={cn(
                                          'priority-indicator absolute left-0 top-0 bottom-0 h-full',
                                          `priority-${priorityKey}`
                                        )}
                                      />
                                      <button
                                        onClick={() => setSelectedIssueId(issue.id)}
                                        className="group flex h-9 w-full items-center gap-3 rounded-md pl-4 pr-4 text-left transition-colors duration-150 ease-snap hover:bg-accent/50"
                                      >
                                        <span
                                          aria-hidden="true"
                                          className="inline-block h-2 w-2 shrink-0 rounded-full border"
                                          style={{ backgroundColor: dotColor, borderColor: dotColor }}
                                        />
                                        <span className="w-16 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                                          {issue.key}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                          {issue.title}
                                        </span>

                                        <span className="ml-auto flex shrink-0 items-center gap-2">
                                          {labels.length > 0 ? (
                                            <span className="hidden md:flex items-center gap-1">
                                              {labels.slice(0, 2).map((label) => (
                                                <span
                                                  key={label}
                                                  className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                                                >
                                                  {label}
                                                </span>
                                              ))}
                                              {labels.length > 2 ? (
                                                <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                                                  +{labels.length - 2}
                                                </span>
                                              ) : null}
                                            </span>
                                          ) : null}

                                          {dueLabel ? (
                                            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                                              <CalendarDays className="h-3 w-3" />
                                              {dueLabel}
                                            </span>
                                          ) : null}

                                          <span
                                            aria-hidden="true"
                                            className={cn(
                                              'h-2 w-2 rounded-full',
                                              priorityKey === 'critical' && 'bg-rose-500',
                                              priorityKey === 'high' && 'bg-orange-500',
                                              priorityKey === 'medium' && 'bg-amber-400',
                                              priorityKey === 'low' && 'bg-muted-foreground/40'
                                            )}
                                            title={`Priority: ${priorityKey}`}
                                          />

                                          {assignees.length > 0 ? (
                                            <AvatarStack max={3} size="xs">
                                              {assignees.map((person) => (
                                                <Avatar key={person.id} size="xs">
                                                  {person.image ? (
                                                    <AvatarImage src={person.image} alt={person.name || person.email} />
                                                  ) : null}
                                                  <AvatarFallback>
                                                    {(person.name || person.email || '?').charAt(0).toUpperCase()}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ))}
                                            </AvatarStack>
                                          ) : null}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="board" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <KanbanBoard projectId={projectId} filters={filters} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-3 animate-fade-up">
                  <span className="kicker">Scheduled</span>
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {scheduledIssues.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-muted-foreground">No scheduled issues in this view.</div>
                    ) : (
                      <ul className="stagger divide-y divide-border/60">
                        {scheduledIssues.map((issue) => {
                          const priorityKey = ['critical', 'high', 'medium', 'low'].includes(issue.priority)
                            ? issue.priority
                            : 'low';
                          return (
                            <li key={issue.id} className="relative">
                              <span
                                aria-hidden="true"
                                className={cn('priority-indicator absolute left-0 top-0 bottom-0 h-full', `priority-${priorityKey}`)}
                              />
                              <button
                                onClick={() => setSelectedIssueId(issue.id)}
                                className="row-interactive flex w-full items-center justify-between gap-4 rounded-md pl-4 pr-4 py-2.5 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{issue.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-mono">{issue.key}</span> ·{' '}
                                    {issue.assignee?.name || issue.assignee?.email || 'Unassigned'}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                  {issue.dueDate ? format(parseISO(issue.dueDate), 'MMM d') : '—'}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="space-y-3 animate-fade-up">
                  <span className="kicker">Unscheduled</span>
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {unscheduledIssues.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-muted-foreground">Everything in this view is scheduled.</div>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {unscheduledIssues.map((issue) => (
                          <li key={issue.id}>
                            <button
                              onClick={() => setSelectedIssueId(issue.id)}
                              className="row-interactive flex w-full items-center justify-between gap-3 rounded-md px-4 py-2.5 text-left"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{issue.title}</p>
                                <p className="text-xs text-muted-foreground font-mono">{issue.key}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="overflow-hidden rounded-lg border border-border bg-card animate-fade-up">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">{format(calendarMonth, 'MMMM yyyy')}</h2>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCalendarMonth((value) => subMonths(value, 1))}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCalendarMonth((value) => addMonths(value, 1))}
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 border-b border-border">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                          'min-h-32 border-r border-b border-border/60 px-2 py-2 last:border-r-0',
                          !isSameMonth(day, calendarMonth) && 'bg-muted/30 text-muted-foreground/60'
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span
                            className={cn(
                              'text-xs font-medium',
                              isToday(day) && 'bg-primary px-1.5 py-0.5 rounded-sm text-primary-foreground'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {dayIssues.length > 1 ? (
                            <span className="chip text-[9px]">{dayIssues.length}</span>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {dayIssues.slice(0, 3).map((issue) => (
                            <button
                              key={issue.id}
                              onClick={() => setSelectedIssueId(issue.id)}
                              className="w-full rounded-sm px-1.5 py-0.5 text-left transition-all duration-150 ease-snap hover:bg-accent/60"
                            >
                              <p className="truncate text-[11px] font-medium">{issue.title}</p>
                              <p className="truncate text-[10px] text-muted-foreground font-mono">{issue.key}</p>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              Stores the active view type and filters as a reusable saved view.
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
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="view-scope" className="text-sm font-medium">
                Scope
              </label>
              <Select value={viewScope} onValueChange={(value) => setViewScope(value as ViewScope)}>
                <SelectTrigger id="view-scope">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="teamspace" disabled={!currentTeamId}>
                    {currentTeamId ? `Teamspace${activeTeamspace ? ` · ${activeTeamspace.name}` : ''}` : 'Teamspace'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Personal views stay private. Project and Teamspace views are shared.
              </p>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={isPinnedView} onCheckedChange={(checked) => setIsPinnedView(checked === true)} />
              Pin this view in the header
            </label>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox checked={isDefaultView} onCheckedChange={(checked) => setIsDefaultView(checked === true)} />
              Set as default view for this scope
            </label>

            {saveViewMutation.error ? (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveViewMutation.error.message}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveViewMutation.mutate()}
              disabled={!viewName.trim() || saveViewMutation.isPending}
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
