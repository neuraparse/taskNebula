'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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
  Star,
  Target,
  Trash2,
} from 'lucide-react';
import {
  BoardFiltersBar,
  DEFAULT_BOARD_FILTERS,
  type BoardFilters,
} from '@/components/kanban/board-filters';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage, AvatarStack } from '@/components/ui/avatar';
import { useIssues, type Issue } from '@/lib/hooks/use-issues';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { useWorkflowStatuses, type WorkflowStatus } from '@/lib/hooks/use-workflow-statuses';
import { useToast } from '@/hooks/use-toast';
import { isApiPermissionError, throwApiResponseError } from '@/lib/client-api-errors';
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
    groupBy:
      activeViewType === 'board' ? 'status' : activeViewType === 'timeline' ? 'dueMonth' : null,
    visibleColumns: ['key', 'title', 'status', 'priority', 'assignee', 'dueDate'],
    sort: {
      field: activeViewType === 'calendar' ? 'dueDate' : 'updatedAt',
      direction: 'desc',
    },
  };
}

function getScopeLabel(scope: ViewScope, t: (key: string) => string) {
  if (scope === 'teamspace') {
    return t('scope.teamspace');
  }

  if (scope === 'personal') {
    return t('scope.personal');
  }

  return t('scope.project');
}

export function ProjectViewsShell({ projectId }: { projectId: string }) {
  const t = useTranslations('issuesViews');
  const tActions = useTranslations('actions');
  const tHome = useTranslations('pagesHome');
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
        await throwApiResponseError(response, t('toast.something_went_wrong'));
      }
      return response.json();
    },
  });

  const getMutationErrorMessage = (error: unknown) =>
    isApiPermissionError(error)
      ? tHome('toast_access_denied_description')
      : t('toast.something_went_wrong');

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

  async function syncDefaultViews(
    scope: ViewScope,
    teamspaceId: string | null,
    excludeViewId?: string
  ) {
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
        await throwApiResponseError(response, t('toast.save_failed_title'));
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
        title: t('toast.view_saved_title'),
        description: t('toast.view_saved_description'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('toast.save_failed_title'),
        description: getMutationErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const updateViewMutation = useMutation({
    mutationFn: async ({ viewId, payload }: { viewId: string; payload: Record<string, any> }) => {
      const response = await fetch(`/api/projects/${projectId}/views/${viewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        await throwApiResponseError(response, t('toast.update_failed_title'));
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
        await throwApiResponseError(response, t('toast.delete_failed_title'));
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
        title: t('toast.update_failed_title'),
        description: getMutationErrorMessage(error),
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
        title: t('toast.update_default_failed_title'),
        description: getMutationErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteView(view: ProjectView) {
    try {
      await deleteViewMutation.mutateAsync(view.id);
      toast({
        title: t('toast.view_deleted_title'),
        description: t('toast.view_deleted_description', { name: view.name }),
      });
    } catch (error) {
      toast({
        title: t('toast.delete_failed_title'),
        description: getMutationErrorMessage(error),
        variant: 'destructive',
      });
    }
  }

  const filteredIssues = useMemo(() => filterIssues(issues, filters), [filters, issues]);
  const scheduledIssues = useMemo(
    () =>
      filteredIssues
        .filter((issue) => issue.dueDate)
        .sort(
          (left, right) =>
            new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime()
        ),
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
    orderedStatuses.push({ id: TRIAGE_GROUP_ID, name: t('shell.triage'), color: '#94a3b8' });
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
        (left, right) =>
          new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
      );
      buckets.set(key, bucket);
    }

    return (
      orderedStatuses
        .map((status) => ({ status, issues: buckets.get(status.id) ?? [] }))
        // Keep the Triage group only when it has items to avoid empty noise at the top of mature projects.
        .filter((group) => group.status.id !== TRIAGE_GROUP_ID || group.issues.length > 0)
    );
  }, [filteredIssues, workflowStatuses, t]);

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
      <div className="bg-background flex h-full flex-col">
        <div className="border-border bg-background shrink-0 border-b px-4 py-1.5">
          {/* Compact toolbar: view-mode icons + filters + actions (icon-only) */}
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={activeViewType}
              onValueChange={(value) => setActiveViewType(value as ViewType)}
              className="shrink-0"
            >
              {/* Icon-only on mobile/tablet (compact squares); icon + label on
                  desktop (lg+). aria-label keeps the icon-only state accessible. */}
              <TabsList className="bg-muted/30 h-7 gap-0.5 rounded-md p-0.5">
                <TabsTrigger
                  value="list"
                  aria-label={t('shell.view_list')}
                  className="data-[state=active]:bg-card data-[state=active]:shadow-xs h-6 w-6 gap-1.5 rounded-sm px-0 lg:w-auto lg:px-2"
                >
                  <LayoutList className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden text-xs font-medium lg:inline">
                    {t('shell.view_list')}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="board"
                  aria-label={t('shell.view_board')}
                  className="data-[state=active]:bg-card data-[state=active]:shadow-xs h-6 w-6 gap-1.5 rounded-sm px-0 lg:w-auto lg:px-2"
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden text-xs font-medium lg:inline">
                    {t('shell.view_board')}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  aria-label={t('shell.view_timeline')}
                  className="data-[state=active]:bg-card data-[state=active]:shadow-xs h-6 w-6 gap-1.5 rounded-sm px-0 lg:w-auto lg:px-2"
                >
                  <GanttChartSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden text-xs font-medium lg:inline">
                    {t('shell.view_timeline')}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  aria-label={t('shell.view_calendar')}
                  className="data-[state=active]:bg-card data-[state=active]:shadow-xs h-6 w-6 gap-1.5 rounded-sm px-0 lg:w-auto lg:px-2"
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden text-xs font-medium lg:inline">
                    {t('shell.view_calendar')}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="bg-border/70 hidden h-4 w-px shrink-0 sm:block" aria-hidden="true" />

            <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
              <BoardFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                issueCount={issues.length}
                filteredCount={filteredIssues.length}
              />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:ml-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('shell.save_view')}
                title={t('shell.save_view')}
                onClick={() => setSaveViewOpen(true)}
                className="h-7 w-7"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                aria-label={t('shell.new_issue')}
                title={t('shell.new_issue')}
                onClick={() => setCreateIssueOpen(true)}
                className="h-7 w-7"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex items-center gap-1.5 pb-1">
                <span className="kicker shrink-0">{t('shell.views')}</span>
                {viewsLoading ? (
                  <span className="text-muted-foreground text-xs">{t('loading')}</span>
                ) : visibleViews.length ? (
                  visibleViews.map((view) => (
                    <div
                      key={view.id}
                      className={cn(
                        'ease-snap inline-flex items-center gap-1 rounded-md border pr-1 text-xs transition-colors duration-150',
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
                        <span className="chip text-[9px]">{getScopeLabel(view.scope, t)}</span>
                      </button>
                      {view.isOwned ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-sm"
                              aria-label={t('shell.manage_view', { name: view.name })}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void handleTogglePinned(view)}>
                              <Star className="mr-2 h-3.5 w-3.5" />
                              {view.isStarred ? t('shell.unpin_view') : t('shell.pin_view')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleToggleDefault(view)}>
                              <Target className="mr-2 h-3.5 w-3.5" />
                              {view.isDefault
                                ? t('shell.clear_default')
                                : t('shell.set_as_default')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => void handleDeleteView(view)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              {t('shell.delete_view')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {t('shell.empty_views', {
                      scope: currentTeamId ? 'teamspace' : 'project',
                    })}
                  </span>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Tabs
          value={activeViewType}
          onValueChange={(value) => setActiveViewType(value as ViewType)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsContent value="list" className="mt-0 min-h-0 flex-1 overflow-hidden">
            <div className="h-full overflow-auto px-5 py-4">
              <div className="border-border bg-card animate-fade-up overflow-hidden rounded-lg border">
                {isLoading ? (
                  <div className="text-muted-foreground px-4 py-8 text-sm">
                    {t('shell.loading_issues')}
                  </div>
                ) : filteredIssues.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                    <p className="text-muted-foreground text-sm">{t('shell.no_issues_match')}</p>
                    <Button size="sm" onClick={() => setCreateIssueOpen(true)}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {t('shell.new_issue_button')}
                    </Button>
                  </div>
                ) : (
                  <div className="stagger">
                    {groupedListIssues.map((group) => {
                      const isCollapsed = !!collapsedGroups[group.status.id];
                      const groupColor = group.status.color || '#94a3b8';

                      return (
                        <section
                          key={group.status.id}
                          className="border-border/60 border-b last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.status.id)}
                            className={cn(
                              'border-border/60 bg-background sticky top-0 z-10 flex w-full items-center gap-2 border-b px-4 py-2 text-left',
                              'hover:bg-accent/40 ease-snap transition-colors duration-150'
                            )}
                            aria-expanded={!isCollapsed}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                            )}
                            <span
                              aria-hidden="true"
                              className="inline-block h-2.5 w-2.5 rounded-full border"
                              style={{ backgroundColor: groupColor, borderColor: groupColor }}
                            />
                            <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                              {group.status.name}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {group.issues.length}
                            </span>
                          </button>

                          {!isCollapsed ? (
                            group.issues.length === 0 ? (
                              <div className="text-muted-foreground px-4 py-3 text-xs">
                                {t('shell.no_items')}
                              </div>
                            ) : (
                              <ul className="divide-border/60 divide-y">
                                {group.issues.map((issue) => {
                                  const priorityKey = [
                                    'critical',
                                    'high',
                                    'medium',
                                    'low',
                                  ].includes(issue.priority)
                                    ? issue.priority
                                    : 'low';
                                  const dotColor = issue.statusColor || groupColor;
                                  const dueLabel = issue.dueDate
                                    ? format(parseISO(issue.dueDate), 'MMM d')
                                    : null;
                                  const assignees = issue.assignee ? [issue.assignee] : [];
                                  const labels = Array.isArray(issue.labels) ? issue.labels : [];

                                  return (
                                    <li key={issue.id} className="relative">
                                      <span
                                        aria-hidden="true"
                                        className={cn(
                                          'priority-indicator absolute bottom-0 left-0 top-0 h-full',
                                          `priority-${priorityKey}`
                                        )}
                                      />
                                      <button
                                        onClick={() => setSelectedIssueId(issue.id)}
                                        className="ease-snap hover:bg-accent/50 group flex h-9 w-full items-center gap-3 rounded-md pl-4 pr-4 text-left transition-colors duration-150"
                                      >
                                        <span
                                          aria-hidden="true"
                                          className="inline-block h-2 w-2 shrink-0 rounded-full border"
                                          style={{
                                            backgroundColor: dotColor,
                                            borderColor: dotColor,
                                          }}
                                        />
                                        <span className="text-muted-foreground w-16 shrink-0 truncate font-mono text-[11px]">
                                          {issue.key}
                                        </span>
                                        <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                                          {issue.title}
                                        </span>

                                        <span className="ml-auto flex shrink-0 items-center gap-2">
                                          {labels.length > 0 ? (
                                            <span className="hidden items-center gap-1 md:flex">
                                              {labels.slice(0, 2).map((label) => (
                                                <span
                                                  key={label}
                                                  className="bg-muted/50 text-muted-foreground rounded-full px-2 py-0.5 text-xs"
                                                >
                                                  {label}
                                                </span>
                                              ))}
                                              {labels.length > 2 ? (
                                                <span className="bg-muted/50 text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                                                  +{labels.length - 2}
                                                </span>
                                              ) : null}
                                            </span>
                                          ) : null}

                                          {dueLabel ? (
                                            <span className="text-muted-foreground hidden items-center gap-1 text-xs sm:inline-flex">
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
                                            title={t('shell.priority_tooltip', {
                                              priority: priorityKey,
                                            })}
                                          />

                                          {assignees.length > 0 ? (
                                            <AvatarStack max={3} size="xs">
                                              {assignees.map((person) => (
                                                <Avatar key={person.id} size="xs">
                                                  {person.image ? (
                                                    <AvatarImage
                                                      src={person.image}
                                                      alt={person.name || person.email}
                                                    />
                                                  ) : null}
                                                  <AvatarFallback>
                                                    {(person.name || person.email || '?')
                                                      .charAt(0)
                                                      .toUpperCase()}
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
                <div className="animate-fade-up space-y-3">
                  <span className="kicker">{t('shell.scheduled')}</span>
                  <div className="border-border bg-card overflow-hidden rounded-lg border">
                    {scheduledIssues.length === 0 ? (
                      <div className="text-muted-foreground px-4 py-8 text-sm">
                        {t('shell.no_scheduled')}
                      </div>
                    ) : (
                      <ul className="stagger divide-border/60 divide-y">
                        {scheduledIssues.map((issue) => {
                          const priorityKey = ['critical', 'high', 'medium', 'low'].includes(
                            issue.priority
                          )
                            ? issue.priority
                            : 'low';
                          return (
                            <li key={issue.id} className="relative">
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'priority-indicator absolute bottom-0 left-0 top-0 h-full',
                                  `priority-${priorityKey}`
                                )}
                              />
                              <button
                                onClick={() => setSelectedIssueId(issue.id)}
                                className="row-interactive flex w-full items-center justify-between gap-4 rounded-md py-2.5 pl-4 pr-4 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{issue.title}</p>
                                  <p className="text-muted-foreground text-xs">
                                    <span className="font-mono">{issue.key}</span> ·{' '}
                                    {issue.assignee?.name ||
                                      issue.assignee?.email ||
                                      t('shell.unassigned')}
                                  </p>
                                </div>
                                <span className="text-muted-foreground shrink-0 text-xs font-medium">
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

                <div className="animate-fade-up space-y-3">
                  <span className="kicker">{t('shell.unscheduled')}</span>
                  <div className="border-border bg-card overflow-hidden rounded-lg border">
                    {unscheduledIssues.length === 0 ? (
                      <div className="text-muted-foreground px-4 py-8 text-sm">
                        {t('shell.all_scheduled')}
                      </div>
                    ) : (
                      <ul className="divide-border/60 divide-y">
                        {unscheduledIssues.map((issue) => (
                          <li key={issue.id}>
                            <button
                              onClick={() => setSelectedIssueId(issue.id)}
                              className="row-interactive flex w-full items-center justify-between gap-3 rounded-md px-4 py-2.5 text-left"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{issue.title}</p>
                                <p className="text-muted-foreground font-mono text-xs">
                                  {issue.key}
                                </p>
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
              <div className="border-border bg-card animate-fade-up overflow-hidden rounded-lg border">
                <div className="border-border flex items-center justify-between border-b px-4 py-3">
                  <h2 className="text-sm font-semibold">{format(calendarMonth, 'MMMM yyyy')}</h2>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCalendarMonth((value) => subMonths(value, 1))}
                      aria-label={t('shell.previous_month')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCalendarMonth((value) => addMonths(value, 1))}
                      aria-label={t('shell.next_month')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="border-border grid grid-cols-7 border-b">
                  {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => (
                    <div
                      key={day}
                      className="text-muted-foreground px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    >
                      {t(`shell.weekday.${day}`)}
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
                          'border-border/60 min-h-32 border-b border-r px-2 py-2 last:border-r-0',
                          !isSameMonth(day, calendarMonth) && 'bg-muted/30 text-muted-foreground/60'
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span
                            className={cn(
                              'text-xs font-medium',
                              isToday(day) &&
                                'bg-primary text-primary-foreground rounded-sm px-1.5 py-0.5'
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
                              className="ease-snap hover:bg-accent/60 w-full rounded-sm px-1.5 py-0.5 text-left transition-all duration-150"
                            >
                              <p className="truncate text-[11px] font-medium">{issue.title}</p>
                              <p className="text-muted-foreground truncate font-mono text-[10px]">
                                {issue.key}
                              </p>
                            </button>
                          ))}
                          {dayIssues.length > 3 ? (
                            <p className="text-muted-foreground text-[10px]">
                              {t('shell.more_count', { count: dayIssues.length - 3 })}
                            </p>
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
            <DialogTitle>{t('save_dialog.title')}</DialogTitle>
            <DialogDescription>{t('save_dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                {t('save_dialog.name_label')}
              </label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder={t('save_dialog.name_placeholder')}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="view-description" className="text-sm font-medium">
                {t('save_dialog.description_label')}
              </label>
              <Input
                id="view-description"
                value={viewDescription}
                onChange={(event) => setViewDescription(event.target.value)}
                placeholder={t('save_dialog.description_placeholder')}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="view-scope" className="text-sm font-medium">
                {t('save_dialog.scope_label')}
              </label>
              <Select value={viewScope} onValueChange={(value) => setViewScope(value as ViewScope)}>
                <SelectTrigger id="view-scope">
                  <SelectValue placeholder={t('save_dialog.scope_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">{t('scope.personal')}</SelectItem>
                  <SelectItem value="project">{t('scope.project')}</SelectItem>
                  <SelectItem value="teamspace" disabled={!currentTeamId}>
                    {currentTeamId
                      ? activeTeamspace
                        ? t('scope.teamspace_named', { name: activeTeamspace.name })
                        : t('scope.teamspace')
                      : t('scope.teamspace')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t('save_dialog.scope_help')}</p>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={isPinnedView}
                onCheckedChange={(checked) => setIsPinnedView(checked === true)}
              />
              {t('save_dialog.pin_label')}
            </label>

            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={isDefaultView}
                onCheckedChange={(checked) => setIsDefaultView(checked === true)}
              />
              {t('save_dialog.default_label')}
            </label>

            {saveViewMutation.error ? (
              <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                {getMutationErrorMessage(saveViewMutation.error)}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)}>
              {tActions('cancel')}
            </Button>
            <Button
              onClick={() => saveViewMutation.mutate()}
              disabled={!viewName.trim() || saveViewMutation.isPending}
            >
              {saveViewMutation.isPending ? t('save_dialog.saving') : t('save_dialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateIssueModal
        open={createIssueOpen}
        onOpenChange={setCreateIssueOpen}
        projectId={projectId}
      />

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
