'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useIssueConversation } from '@/lib/hooks/use-chat';
import { MessageSquareText, PhoneCall } from 'lucide-react';

export function IssueDiscussionCard({
  issueId,
  projectId,
}: {
  issueId: string;
  projectId: string;
}) {
  const { data, isLoading, error } = useIssueConversation(issueId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Discussion</CardTitle>
          {data?.room?.id ? (
            <Badge variant="outline">{data.messages.length} messages</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading discussion…</div>
        ) : error ? (
          <div className="text-sm text-muted-foreground">{error.message}</div>
        ) : data ? (
          <>
            <div className="space-y-2">
              {data.messages.slice(-2).map((message) => (
                <div key={message.id} className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">{message.author.name || message.author.email || 'Unknown'}</div>
                  <div className="mt-1 line-clamp-2 text-sm">
                    {message.deletedAt ? 'Message deleted' : message.body || 'Attachment-only update'}
                  </div>
                </div>
              ))}
              {!data.messages.length ? (
                <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  No messages yet. Use the issue thread when the work needs quick alignment.
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
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
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Discussion is unavailable.</div>
        )}
      </CardContent>
    </Card>
  );
}
