import {
  Skeleton,
  SkeletonKanbanColumn,
} from '@/components/ui/skeleton';

export default function BoardLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4">
        <div className="flex h-full gap-3">
          <SkeletonKanbanColumn title="Backlog" cards={3} />
          <SkeletonKanbanColumn title="To Do" cards={4} />
          <SkeletonKanbanColumn title="In Progress" cards={2} />
          <SkeletonKanbanColumn title="In Review" cards={2} />
          <SkeletonKanbanColumn title="Done" cards={3} />
        </div>
      </div>
    </div>
  );
}
