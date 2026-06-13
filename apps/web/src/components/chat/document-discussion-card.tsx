'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDocumentConversation } from '@/lib/hooks/use-chat';
import { MessageSquareText, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DocumentDiscussionCard({
  pageId,
  projectId,
}: {
  pageId: string;
  projectId: string;
}) {
  const t = useTranslations('collab');
  // Realtime hook — not modified.
  const { data, isLoading, error } = useDocumentConversation(pageId);

  return (
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          {t('discussion.title')}
        </span>
        {data?.room?.id && data.messages.length > 0 && (
          <span className="chip text-[11px]">
            {t('discussion.messageCount', { count: data.messages.length })}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t('discussion.loading')}</p>
      ) : error ? (
        <p className="text-muted-foreground text-sm">{error.message}</p>
      ) : data ? (
        <div className="space-y-2">
          {/* Last two messages — compact preview */}
          {data.messages.length === 0 ? (
            <p className="text-muted-foreground border-border/60 rounded-md border border-dashed px-3 py-3 text-sm">
              {t('discussion.emptyDocument')}
            </p>
          ) : (
            data.messages.slice(-2).map((message) => (
              <div key={message.id} className="border-primary/40 space-y-1 border-l-2 py-1 pl-3">
                <p className="text-muted-foreground text-[11px] font-medium">
                  {message.author.name || message.author.email || t('discussion.unknownAuthor')}
                </p>
                <p
                  className={cn(
                    'line-clamp-2 text-sm leading-relaxed',
                    message.deletedAt && 'text-muted-foreground italic'
                  )}
                >
                  {message.deletedAt
                    ? t('discussion.messageDeleted')
                    : message.body || t('discussion.attachmentOnly')}
                </p>
              </div>
            ))
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/chat?roomId=${data.room.id}`}>
                <MessageSquareText className="mr-1.5 h-4 w-4" />
                {t('discussion.openDiscussion')}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/projects/${projectId}/chat?roomId=${data.room.id}`}>
                <PhoneCall className="mr-1.5 h-4 w-4" />
                {data.activeCall ? t('call.join') : t('call.start')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t('discussion.unavailable')}</p>
      )}
    </div>
  );
}
