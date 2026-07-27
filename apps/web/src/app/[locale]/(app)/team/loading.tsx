import { Skeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/ui/page-frame';

export default function TeamLoading() {
  return (
    <PageFrame>
      <div
        className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between"
        aria-busy="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      <div className="border-border flex gap-1 overflow-hidden border-b pb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:w-40" />
      </div>
      <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-lg border">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-sm" />
          </div>
        ))}
      </div>
    </PageFrame>
  );
}
