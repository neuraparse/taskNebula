import { Skeleton } from '@/components/ui/skeleton';

export function RoadmapLoadingShell() {
  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <div className="space-y-6 px-6 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="border-border bg-card overflow-hidden rounded-lg border">
          <div className="border-border bg-muted/20 flex items-center gap-2 border-b px-4 py-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1" />
            ))}
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 rounded-md" style={{ width: `${30 + i * 10}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
