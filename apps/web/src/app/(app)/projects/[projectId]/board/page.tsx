'use client';

import { useState, use, useEffect } from 'react';
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

  useEffect(() => {
    if (!isInitialized && !sprintsLoading && sprints !== undefined) {
      if (activeSprint) {
        setSelectedSprintId(activeSprint.id);
      }
      setIsInitialized(true);
    }
  }, [sprints, sprintsLoading, activeSprint, isInitialized]);

  const currentSprint = selectedSprintId
    ? sprints?.find((s) => s.id === selectedSprintId)
    : null;

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
      <div className="shrink-0 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          {/* Sprint selector */}
          <Select
            value={selectedSprintId || 'all'}
            onValueChange={(value) => setSelectedSprintId(value === 'all' ? undefined : value)}
          >
            <SelectTrigger className="h-8 w-48 border-border bg-background text-xs shadow-none">
              <SelectValue placeholder="All Issues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Issues</SelectItem>
              <SelectItem value="backlog">Backlog (No Sprint)</SelectItem>
              {sprints && sprints.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Sprints
                  </div>
                  {sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      <span className="flex items-center gap-2">
                        {sprint.name}
                        {sprint.status === 'active' && (
                          <Badge variant="default" className="h-3.5 bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20 px-1 py-0 text-[9px]">
                            Active
                          </Badge>
                        )}
                        {sprint.status === 'planned' && (
                          <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
                            Planned
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{currentSprint.issueCount || 0} issues</span>
              {sprintProgress && sprintProgress.daysLeft > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className={sprintProgress.daysLeft <= 2 ? 'text-accent-amber font-medium' : ''}>
                    {sprintProgress.daysLeft}d left
                  </span>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSelectedSprintId(undefined)}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}

          {!activeSprint && !sprintsLoading && isInitialized && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertCircle className="h-3 w-3 text-accent-amber" />
              No active sprint
              <Link href={`/projects/${projectId}/sprints`} className="text-primary hover:underline ml-0.5">
                {plannedSprints.length > 0 ? 'Start' : 'Create'}
              </Link>
            </div>
          )}

          {/* Separator */}
          <div className="h-5 w-px bg-border/70" />

          {/* Filters */}
          <div className="min-w-0 flex-1">
            <BoardFiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              issueCount={issues?.length || 0}
              filteredCount={issues?.length || 0}
            />
          </div>

          {/* Spacer + New Issue */}
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="h-8 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Issue
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          projectId={projectId}
          sprintId={effectiveSprintId}
          filters={filters}
        />
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
