import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-3">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col">
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md p-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </aside>
        <div className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}
              >
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="max-w-md flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
          <div className="shrink-0 border-t border-border p-4">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
