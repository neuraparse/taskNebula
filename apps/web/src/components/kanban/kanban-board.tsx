'use client';

import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { AddColumnDialog } from './add-column-dialog';
import { BoardFiltersBar, BoardFilters } from './board-filters';
import { useIssues, useUpdateIssue } from '@/lib/hooks/use-issues';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WorkflowStatus {
  id: string;
  name: string;
  category: string;
  color: string;
  position: number;
}

export function KanbanBoard({ projectId, sprintId }: { projectId: string; sprintId?: string }) {
  const { data: issues, isLoading, error } = useIssues({ projectId, sprintId });
  const updateIssue = useUpdateIssue();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>({
    search: '',
    priority: [],
    assignee: [],
    labels: [],
  });

  // Fetch workflow statuses
  const fetchStatuses = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow-statuses`);
      if (response.ok) {
        const data = await response.json();
        setWorkflowStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error('Error fetching workflow statuses:', error);
    } finally {
      setLoadingStatuses(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, [projectId]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    if (!issues) return [];

    return issues.filter((issue) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          issue.title.toLowerCase().includes(searchLower) ||
          issue.key.toLowerCase().includes(searchLower) ||
          issue.description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Priority filter
      if (filters.priority.length > 0) {
        if (!filters.priority.includes(issue.priority)) return false;
      }

      return true;
    });
  }, [issues, filters]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const issueId = active.id as string;
    const newStatusId = over.id as string;

    const issue = filteredIssues?.find((i) => i.id === issueId);
    if (!issue || issue.statusId === newStatusId) return;

    // Optimistically update the cache
    const queryKey = ['issues', { projectId, sprintId }];
    queryClient.setQueryData(queryKey, (oldData: any) => {
      if (!oldData?.issues) return oldData;
      return {
        ...oldData,
        issues: oldData.issues.map((i: any) =>
          i.id === issueId ? { ...i, statusId: newStatusId } : i
        ),
      };
    });

    // Update on server
    updateIssue.mutate(
      {
        issueId,
        data: { statusId: newStatusId },
      },
      {
        onError: () => {
          queryClient.invalidateQueries({ queryKey });
        },
      }
    );
  };

  const activeIssue = filteredIssues?.find((i) => i.id === activeId);

  if (isLoading || loadingStatuses) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">Failed to load issues</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No issues found</p>
          <p className="text-xs text-muted-foreground">Create your first issue to get started</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Filters */}
        <div className="px-5 pt-4 pb-3 border-b bg-background/95 backdrop-blur">
          <BoardFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            issueCount={issues?.length || 0}
            filteredCount={filteredIssues.length}
          />
        </div>

        {/* Board */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          collisionDetection={closestCorners}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto px-5 py-4 custom-scrollbar">
            {workflowStatuses.map((status) => {
              const columnIssues = filteredIssues.filter((issue) => issue.statusId === status.id);
              return (
                <KanbanColumn
                  key={status.id}
                  column={{
                    id: status.id,
                    name: status.name,
                    color: status.color,
                    category: status.category,
                  }}
                  issueCount={columnIssues.length}
                  projectId={projectId}
                >
                  <div className="space-y-2">
                    {columnIssues.map((issue) => (
                      <KanbanCard
                        key={issue.id}
                        issue={{
                          id: issue.key,
                          title: issue.title,
                          priority: issue.priority as 'low' | 'medium' | 'high' | 'critical',
                          type: issue.type as 'task' | 'bug' | 'story' | 'epic',
                          assignee: issue.assignee
                            ? {
                                name: issue.assignee.name || issue.assignee.email,
                                avatar:
                                  issue.assignee.name
                                    ?.split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase() || issue.assignee.email?.[0]?.toUpperCase() || '?',
                              }
                            : undefined,
                          labels: [],
                        }}
                        draggableId={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                      />
                    ))}
                  </div>
                </KanbanColumn>
              );
            })}

            {/* Add Column Button */}
            <div className="flex-shrink-0 w-[300px]">
              <Button
                variant="ghost"
                className="w-full h-12 border-2 border-dashed rounded-xl border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground/50 hover:text-primary"
                onClick={() => setAddColumnOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Column
              </Button>
            </div>
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {activeIssue ? (
              <div className="rotate-2 scale-105 w-[284px]">
                <KanbanCard
                  issue={{
                    id: activeIssue.key,
                    title: activeIssue.title,
                    priority: activeIssue.priority as 'low' | 'medium' | 'high' | 'critical',
                    type: activeIssue.type as 'task' | 'bug' | 'story' | 'epic',
                    assignee: activeIssue.assignee
                      ? {
                          name: activeIssue.assignee.name || activeIssue.assignee.email,
                          avatar:
                            activeIssue.assignee.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase() || activeIssue.assignee.email?.[0]?.toUpperCase() || '?',
                        }
                      : undefined,
                    labels: [],
                  }}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Issue Detail Modal */}
      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => !open && setSelectedIssueId(null)}
        />
      )}

      {/* Add Column Dialog */}
      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        projectId={projectId}
        onSuccess={fetchStatuses}
      />
    </>
  );
}
