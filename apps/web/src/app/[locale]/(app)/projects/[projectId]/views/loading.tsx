import { Skeleton } from '@/components/ui/skeleton';

export default function ViewsLoading() {
  return (
    <div className="bg-background flex h-full flex-col" aria-busy="true">
      <div className="border-border shrink-0 space-y-2 border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="hidden h-4 w-px sm:block" />
          <Skeleton className="order-last h-8 w-full sm:order-none sm:min-w-40 sm:flex-1" />
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
        <div className="flex items-center gap-2 overflow-hidden pb-1">
          <Skeleton className="h-3 w-12 shrink-0" />
          <Skeleton className="h-7 w-28 shrink-0 rounded-md" />
          <Skeleton className="h-7 w-36 shrink-0 rounded-md" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
        <div className="border-border bg-card overflow-hidden rounded-lg border">
          {Array.from({ length: 3 }).map((_, groupIndex) => (
            <div key={groupIndex} className="border-border/60 border-b last:border-b-0">
              <div className="border-border/60 bg-background flex h-9 items-center gap-2 border-b px-4">
                <Skeleton className="h-3.5 w-3.5" />
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              {Array.from({ length: groupIndex === 0 ? 3 : 2 }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className="border-border/60 flex h-9 items-center gap-3 border-b px-4 last:border-b-0"
                >
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-4 min-w-0 flex-1" />
                  <Skeleton className="hidden h-3 w-20 sm:block" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
