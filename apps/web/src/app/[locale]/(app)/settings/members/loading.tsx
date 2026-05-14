import {
  Skeleton,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function MembersLoading() {
  return (
    <div className="flex h-full flex-col overflow-y-auto custom-scrollbar">
      <div className="space-y-6 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <SkeletonTable rows={8} columns={5} />
      </div>
    </div>
  );
}
