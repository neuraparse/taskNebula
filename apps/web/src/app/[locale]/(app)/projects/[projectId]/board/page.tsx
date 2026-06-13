'use client';

import { useState, use, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { BoardFiltersBar, BoardFilters } from '@/components/kanban/board-filters';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, AlertCircle } from 'lucide-react';
import { useSprints } from '@/lib/hooks/use-sprints';
import { useIssues } from '@/lib/hooks/use-issues';
import Link from 'next/link';

export default function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const t = useTranslations('pagesProjects');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>({
    search: '',
    priority: [],
    assignee: [],
    labels: [],
  });

  const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
  const activeSprint = sprints?.find((s) => s.status === 'active');
  const plannedSprints = sprints?.filter((s) => s.status === 'planned') || [];

  const effectiveSprintId = selectedSprintId === 'backlog' ? 'none' : selectedSprintId;
  const { data: issues } = useIssues({ projectId, sprintId: effectiveSprintId });

  const filteredCount = useMemo(() => {
    if (!issues) return 0;
    return issues.filter((issue) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches =
          issue.title.toLowerCase().includes(q) ||
          issue.key.toLowerCase().includes(q) ||
          issue.description?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
        return false;
      }
      return true;
    }).length;
  }, [issues, filters]);

  useEffect(() => {
    if (!isInitialized && !sprintsLoading && sprints !== undefined) {
      if (activeSprint) {
        setSelectedSprintId(activeSprint.id);
      }
      setIsInitialized(true);
    }
  }, [sprints, sprintsLoading, activeSprint, isInitialized]);

  const currentSprint = selectedSprintId ? sprints?.find((s) => s.id === selectedSprintId) : null;

  const getSprintProgress = () => {
    if (!currentSprint || currentSprint.status !== 'active') return null;
    const start = new Date(currentSprint.startDate).getTime();
    const end = new Date(currentSprint.endDate).getTime();
    const now = Date.now();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return { daysLeft };
  };

  const sprintProgress = getSprintProgress();

  return (
    <div className="flex h-full flex-col">
      {/* Board Header - single compact row */}
      <div className="border-border bg-background/95 shrink-0 border-b px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Sprint selector */}
          <Select
            value={selectedSprintId || 'all'}
            onValueChange={(value) => setSelectedSprintId(value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="border-border bg-background h-8 w-40 shrink-0 text-xs shadow-none sm:w-48">
              <SelectValue placeholder={t('allIssues')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allIssues')}</SelectItem>
              <SelectItem value="backlog">{t('backlogNoSprint')}</SelectItem>
              {sprints && sprints.length > 0 && (
                <>
                  <div className="text-muted-foreground px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
                    {t('sprintsHeader')}
                  </div>
                  {sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      <span className="flex items-center gap-2">
                        {sprint.name}
                        {sprint.status === 'active' && (
                          <Badge
                            variant="default"
                            className="bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20 h-3.5 px-1 py-0 text-[9px]"
                          >
                            {t('statusActive')}
                          </Badge>
                        )}
                        {sprint.status === 'planned' && (
                          <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
                            {t('statusPlanned')}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* Sprint meta */}
          {currentSprint && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span>{t('issuesCount', { count: currentSprint.issueCount || 0 })}</span>
              {sprintProgress && sprintProgress.daysLeft > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span
                    className={sprintProgress.daysLeft <= 2 ? 'text-accent-amber font-medium' : ''}
                  >
                    {t('daysLeft', { count: sprintProgress.daysLeft })}
                  </span>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-muted hover:text-foreground h-5 w-5"
                onClick={() => setSelectedSprintId(undefined)}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}

          {!activeSprint && !sprintsLoading && isInitialized && (
            <div className="text-muted-foreground flex w-full shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] sm:w-auto">
              <AlertCircle className="text-accent-amber h-3 w-3 shrink-0" />
              {t('noActiveSprint')}
              <Link
                href={`/projects/${projectId}/sprints`}
                className="text-primary ml-0.5 hover:underline"
              >
                {plannedSprints.length > 0 ? t('startSprintLink') : t('createSprintLink')}
              </Link>
            </div>
          )}

          {/* Separator */}
          <div className="bg-border/70 hidden h-5 w-px sm:block" />

          {/* Filters */}
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <BoardFiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              issueCount={issues?.length || 0}
              filteredCount={filteredCount}
            />
          </div>

          {/* Spacer + New Issue */}
          <div className="ml-auto shrink-0">
            <Button size="sm" onClick={() => setCreateModalOpen(true)} className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('newIssue')}
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard projectId={projectId} sprintId={effectiveSprintId} filters={filters} />
      </div>

      <CreateIssueModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
        sprintId={selectedSprintId === 'backlog' ? undefined : selectedSprintId}
      />
    </div>
  );
}
