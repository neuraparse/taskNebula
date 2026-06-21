import { Skeleton, SkeletonList } from '@/components/ui/skeleton';

export function BacklogLoadingShell() {
  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <div className="space-y-4 px-6 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="border-border bg-card rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <SkeletonList items={6} className="p-2" />
        </div>
        <div className="border-border bg-card rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <SkeletonList items={5} className="p-2" />
        </div>
      </div>
    </div>
  );
}
