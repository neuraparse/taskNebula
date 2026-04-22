import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export default function ProjectDocsLoading() {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col">
        <div className="border-b border-border p-3">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        <div className="space-y-1 p-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-7 w-full rounded-md"
              style={{ width: `${60 + (i % 3) * 15}%` }}
            />
          ))}
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 space-y-6">
        <Skeleton className="h-9 w-2/3" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
        <SkeletonText lines={6} />
        <SkeletonText lines={4} />
      </div>
    </div>
  );
}
