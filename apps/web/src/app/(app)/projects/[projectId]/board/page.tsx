'use client';

import { useState, use, useEffect } from 'react';
import { KanbanBoard } from '@/components/kanban/kanban-board';
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
import { Plus, Filter, X, Timer, AlertCircle } from 'lucide-react';
import { useSprints } from '@/lib/hooks/use-sprints';
import Link from 'next/link';

export default function ProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: sprints, isLoading: sprintsLoading } = useSprints(projectId);
  const activeSprint = sprints?.find((s) => s.status === 'active');
  const plannedSprints = sprints?.filter((s) => s.status === 'planned') || [];

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
    const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return { progress, daysLeft };
  };

  const sprintProgress = getSprintProgress();

  return (
    <div className="flex h-full flex-col">
      {/* Board Header */}
      <div className="border-b bg-background/95 backdrop-blur px-5 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Sprint Filter */}
          <div className="flex items-center gap-3">
            <Select
              value={selectedSprintId || 'all'}
              onValueChange={(value) => setSelectedSprintId(value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-56 h-9 text-sm">
                <SelectValue placeholder="All Issues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Issues</SelectItem>
                <SelectItem value="backlog">Backlog (No Sprint)</SelectItem>
                {sprints && sprints.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Sprints
                    </div>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        <span className="flex items-center gap-2">
                          {sprint.name}
                          {sprint.status === 'active' && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500">
                              Active
                            </Badge>
                          )}
                          {sprint.status === 'planned' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              Planned
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-xs">({sprint.issueCount})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            {/* Sprint Info */}
            {currentSprint && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-border">|</span>
                <span className="text-muted-foreground text-xs">{currentSprint.issueCount || 0} issues</span>
                {sprintProgress && (
                  <>
                    <span className="text-border">|</span>
                    <span
                      className={
                        sprintProgress.daysLeft <= 2
                          ? 'text-orange-500 font-medium text-xs'
                          : 'text-muted-foreground text-xs'
                      }
                    >
                      {sprintProgress.daysLeft > 0 ? `${sprintProgress.daysLeft}d left` : 'Ending today'}
                    </span>
                  </>
                )}
                {selectedSprintId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => setSelectedSprintId(undefined)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {/* No Active Sprint Warning */}
            {!activeSprint && !sprintsLoading && isInitialized && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                <span>No active sprint</span>
                <Link
                  href={`/projects/${projectId}/sprints`}
                  className="text-primary hover:underline"
                >
                  {plannedSprints.length > 0 ? 'Start a sprint' : 'Create a sprint'}
                </Link>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Issue
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          projectId={projectId}
          sprintId={selectedSprintId === 'backlog' ? 'none' : selectedSprintId}
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
