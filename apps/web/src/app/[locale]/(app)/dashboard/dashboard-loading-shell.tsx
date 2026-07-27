import { MetricStrip, type MetricStripItem } from '@/components/ui/metric-strip';
import { PageFrame } from '@/components/ui/page-frame';
import { Skeleton, SkeletonPageHeader } from '@/components/ui/skeleton';

export function DashboardLoadingShell() {
  const metrics: MetricStripItem[] = Array.from({ length: 4 }, (_, index) => ({
    id: `metric-${index}`,
    label: <Skeleton className="h-3 w-16" />,
    value: <Skeleton className="h-7 w-10" />,
  }));

  return (
    <PageFrame className="dashboard-carbon" contentClassName="animate-pulse">
      <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between">
        <SkeletonPageHeader />
        <Skeleton className="h-8 w-full sm:w-28" />
      </div>

      <MetricStrip items={metrics} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div className="surface-card overflow-hidden">
            <div className="border-border flex min-h-11 items-center justify-between border-b px-4 py-2.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="divide-border divide-y px-2 py-2">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex min-h-11 items-center gap-3 px-2 py-2.5">
                  <Skeleton className="h-6 w-0.5" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="hidden h-3 w-20 sm:block" />
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card space-y-3 p-4">
            <Skeleton className="h-4 w-36" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex min-h-10 items-center gap-3 px-2 py-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card space-y-3 p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="surface-card space-y-3 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="surface-card space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex min-h-10 items-center gap-3 px-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card flex min-h-14 items-center justify-between px-4 py-3">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    </PageFrame>
  );
}
