import { Skeleton, SkeletonPageHeader, SkeletonList } from '@/components/ui/skeleton';

export function MyIssuesLoadingShell() {
  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <div className="space-y-6 px-6 py-6">
        <div className="flex items-center justify-between">
          <SkeletonPageHeader />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <SkeletonList items={8} />
      </div>
    </div>
  );
}
