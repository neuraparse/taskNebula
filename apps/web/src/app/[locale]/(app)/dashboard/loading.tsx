import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonList,
} from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col overflow-y-auto custom-scrollbar">
      <div className="space-y-6 px-6 py-6">
        <SkeletonPageHeader />
        <SkeletonStats count={4} />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <SkeletonList items={5} />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
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
