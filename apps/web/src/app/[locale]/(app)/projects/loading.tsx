import { Skeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/ui/page-frame';

export default function ProjectsLoading() {
  return (
    <PageFrame className="animate-fade-in" contentClassName="space-y-4">
      <div
        className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between"
        aria-busy="true"
      >
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="border-border bg-card divide-border w-full divide-y overflow-hidden rounded-lg border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <div className="col-start-2 flex items-center gap-3 sm:col-auto">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </PageFrame>
  );
}
