import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="space-y-1 p-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full max-w-md rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
