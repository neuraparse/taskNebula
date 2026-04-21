'use client';

import Link from 'next/link';
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
  // Realtime hook — not modified.
  const { data, isLoading, error } = useDocumentConversation(pageId);

  return (
    <div className="space-y-3">
      {/* Section label */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Discussion
        </span>
        {data?.room?.id && data.messages.length > 0 && (
          <span className="chip text-[11px]">
            {data.messages.length} {data.messages.length === 1 ? 'message' : 'messages'}
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading discussion…</p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">{error.message}</p>
      ) : data ? (
        <div className="space-y-2">
          {/* Last two messages — compact preview */}
          {data.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground border border-dashed border-border rounded-md px-3 py-3">
              No messages yet. Keep spec decisions and implementation notes in one linked thread.
            </p>
          ) : (
            data.messages.slice(-2).map((message) => (
              <div
                key={message.id}
                className="surface-inset rounded-md px-3 py-2 space-y-1"
              >
                <p className="text-[11px] font-medium text-muted-foreground">
                  {message.author.name || message.author.email || 'Unknown'}
                </p>
                <p className={cn('text-sm leading-snug prose-sm line-clamp-2', message.deletedAt && 'italic text-muted-foreground')}>
                  {message.deletedAt ? 'Message deleted' : message.body || 'Attachment-only update'}
                </p>
              </div>
            ))
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/chat?roomId=${data.room.id}`}>
                <MessageSquareText className="mr-1.5 h-4 w-4" />
                Open discussion
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/projects/${projectId}/chat?roomId=${data.room.id}`}>
                <PhoneCall className="mr-1.5 h-4 w-4" />
                {data.activeCall ? 'Join call' : 'Start call'}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Discussion is unavailable.</p>
      )}
    </div>
  );
}
