'use client';

import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { AddColumnDialog } from './add-column-dialog';
import { DEFAULT_BOARD_FILTERS, type BoardFilters } from './board-filters';
import { useIssues, useUpdateIssue } from '@/lib/hooks/use-issues';
import { useWorkflowStatuses } from '@/lib/hooks/use-workflow-statuses';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { Loader2, Plus, Kanban as LayoutKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  closestCenter,
  CollisionDetection,
  MeasuringStrategy,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface KanbanBoardProps {
  projectId: string;
  sprintId?: string;
  filters?: BoardFilters;
}

export function KanbanBoard({ projectId, sprintId, filters }: KanbanBoardProps) {
  const { data: issues, isLoading: issuesLoading, error } = useIssues({ projectId, sprintId });
  const { data: workflowStatuses = [], isLoading: statusesLoading } = useWorkflowStatuses(projectId);
  const updateIssue = useUpdateIssue();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const activeFilters = filters ?? DEFAULT_BOARD_FILTERS;

  const filteredIssues = useMemo(() => {
    if (!issues) return [];

    return issues.filter((issue) => {
      if (activeFilters.search) {
        const searchLower = activeFilters.search.toLowerCase();
        const matchesSearch =
          issue.title.toLowerCase().includes(searchLower) ||
          issue.key.toLowerCase().includes(searchLower) ||
          issue.description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (activeFilters.priority.length > 0) {
        if (!activeFilters.priority.includes(issue.priority)) return false;
      }

      return true;
    });
  }, [activeFilters, issues]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerIntersections = pointerWithin(args);
    if (pointerIntersections.length > 0) return pointerIntersections;
    const rect = rectIntersection(args);
    if (rect.length > 0) return rect;
    return closestCenter(args);
  };

  const announcements = {
    onDragStart({ active }: { active: { id: string | number } }) {
      return `Picked up issue. Use arrow keys to move between columns.`;
    },
    onDragOver({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) {
      if (over) return `Issue is over a drop target.`;
      return `Issue is not over a drop target.`;
    },
    onDragEnd({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) {
      if (over) return `Issue was moved.`;
      return `Issue drop was cancelled.`;
    },
    onDragCancel() {
      return `Dragging cancelled.`;
    },
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeData = active.data.current as { type?: string; statusId?: string; issueId?: string } | undefined;
    const overData = over.data.current as { type?: string; statusId?: string } | undefined;

    if (activeData?.type !== 'card') return;

    const targetStatusId =
      overData?.type === 'column' || overData?.type === 'card'
        ? overData.statusId
        : undefined;

    const issueId = activeData.issueId;
    if (!issueId || !targetStatusId) return;
    if (activeData.statusId === targetStatusId) return;

    updateIssue.mutate({ issueId, data: { statusId: targetStatusId } });
  };

  const activeIssue = filteredIssues?.find((i) => i.id === activeId);

  const isLoading = issuesLoading || statusesLoading;

  if (isLoading) {
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

  if (workflowStatuses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <LayoutKanban className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No columns yet</p>
        <Button variant="outline" size="sm" onClick={() => setAddColumnOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add column
        </Button>
        <AddColumnDialog
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
          projectId={projectId}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['workflow-statuses', projectId] })}
        />
      </div>
    );
  }

  return (
    <>
      <div className="dot-grid flex h-full flex-col bg-background">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          collisionDetection={collisionDetection}
          accessibility={{ announcements }}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <div className="stagger flex flex-1 gap-3 overflow-x-auto px-4 py-4 custom-scrollbar">
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
                  statusId={status.id}
                  issueIds={columnIssues.map((i) => i.id)}
                >
                  {columnIssues.map((issue) => (
                    <KanbanCard
                      key={issue.id}
                      draggableId={issue.id}
                      statusId={status.id}
                      issueId={issue.id}
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
                      onClick={() => setSelectedIssueId(issue.id)}
                    />
                  ))}
                </KanbanColumn>
              );
            })}

            <div className="w-[280px] flex-shrink-0 self-start">
              <Button
                variant="ghost"
                className="h-10 w-full rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-all duration-200 ease-smooth hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                onClick={() => setAddColumnOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add column
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
              <div className="w-[288px] rotate-[0.8deg] shadow-md">
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

      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => !open && setSelectedIssueId(null)}
        />
      )}

      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        projectId={projectId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['workflow-statuses', projectId] })}
      />
    </>
  );
}
