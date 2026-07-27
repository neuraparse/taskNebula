import { Skeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/ui/page-frame';

export default function SprintsLoading() {
  return (
    <PageFrame contentClassName="space-y-5">
      <div
        className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between"
        aria-busy="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border-border bg-card rounded-lg border p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-44 max-w-[60%]" />
                  <Skeleton className="h-5 w-20 rounded-sm" />
                </div>
                <Skeleton className="h-4 w-[min(32rem,90%)]" />
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {index === 0 ? (
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-1.5 flex-1 rounded-sm" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                ) : null}
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </PageFrame>
  );
}
