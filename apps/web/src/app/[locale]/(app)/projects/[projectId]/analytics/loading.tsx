import { Skeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/ui/page-frame';

export default function AnalyticsLoading() {
  return (
    <PageFrame contentClassName="space-y-6">
      <div
        className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between"
        aria-busy="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded-md sm:w-20 sm:flex-none" />
          <Skeleton className="h-8 flex-1 rounded-md sm:w-20 sm:flex-none" />
        </div>
      </div>

      <div className="surface-card bg-border grid grid-cols-2 gap-px overflow-hidden shadow-none md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-card flex min-h-[72px] flex-col gap-2 p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            {index === 3 ? <Skeleton className="h-3 w-24" /> : null}
          </div>
        ))}
      </div>

      <div className="border-border bg-card space-y-4 rounded-lg border p-4 sm:p-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-64 max-w-full" />
        <Skeleton className="h-64 w-full" />
      </div>

      <div className="border-border bg-card grid divide-y overflow-hidden rounded-lg border md:grid-cols-3 md:divide-x md:divide-y-0">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-3 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    </PageFrame>
  );
}
