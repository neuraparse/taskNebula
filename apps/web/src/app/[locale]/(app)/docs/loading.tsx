import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export default function DocsLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 space-y-6">
        <Skeleton className="h-9 w-2/3" />
        <SkeletonText lines={6} />
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
