import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonKanbanColumn } from '@/components/ui/skeleton';

export default async function BoardLoading() {
  const t = await getTranslations('userSecurity');

  return (
    <div className="flex h-full flex-col">
      <div className="border-border shrink-0 border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-4">
        <div className="flex h-full gap-3">
          <SkeletonKanbanColumn title={t('columnBacklog')} cards={3} />
          <SkeletonKanbanColumn title={t('columnToDo')} cards={4} />
          <SkeletonKanbanColumn title={t('columnInProgress')} cards={2} />
          <SkeletonKanbanColumn title={t('columnInReview')} cards={2} />
          <SkeletonKanbanColumn title={t('columnDone')} cards={3} />
        </div>
      </div>
    </div>
  );
}
