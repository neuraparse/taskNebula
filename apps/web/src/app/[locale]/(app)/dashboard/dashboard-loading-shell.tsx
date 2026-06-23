import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonList,
} from '@/components/ui/skeleton';

export function DashboardLoadingShell() {
  return (
    <div className="dashboard-carbon custom-scrollbar bg-background flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[1680px] space-y-3 p-3 sm:p-4 lg:p-5">
        <div className="surface-card p-5">
          <SkeletonPageHeader />
        </div>
        <SkeletonStats count={4} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="surface-card space-y-3 p-5">
            <Skeleton className="h-5 w-40" />
            <SkeletonList items={5} />
          </div>
          <div className="space-y-4">
            <div className="surface-card space-y-3 p-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="surface-card space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
