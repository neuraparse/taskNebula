import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonCard,
} from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <div className="flex h-full flex-col overflow-y-auto custom-scrollbar">
      <div className="space-y-6 px-6 py-6">
        <div className="flex items-center justify-between">
          <SkeletonPageHeader />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
