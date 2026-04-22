import { Skeleton } from '@/components/ui/skeleton';

export default function IssueDetailLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="overflow-y-auto custom-scrollbar">
            <div className="space-y-6 px-5 py-6 lg:px-8">
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="space-y-2 pt-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            </div>
          </div>
          <aside className="hidden overflow-y-auto border-l border-border custom-scrollbar lg:block">
            <div className="space-y-5 px-5 py-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
