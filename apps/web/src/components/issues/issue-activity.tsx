'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Loader2, Sparkles } from 'lucide-react';
import { useComments, useCreateComment } from '@/lib/hooks/use-comments';
import { useActivities } from '@/lib/hooks/use-activities';
import { useSummarizeThread } from '@/lib/hooks/use-ai';
import { useIssue } from '@/lib/hooks/use-issues';
import { MentionTextarea } from './mention-textarea';
import { formatDistanceToNow } from 'date-fns';

export function IssueActivity({ issueId }: { issueId: string }) {
  const [newComment, setNewComment] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const { data: issue } = useIssue(issueId);
  const { data: comments, isLoading: commentsLoading } = useComments(issueId);
  const { data: activities, isLoading: activitiesLoading } = useActivities(issueId);
  const createComment = useCreateComment(issueId);
  const summarizeThread = useSummarizeThread();

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync(newComment.trim());
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleSummarize = async () => {
    try {
      const result = await summarizeThread.mutateAsync({ issueId });
      setSummary(result.summary);
    } catch (error) {
      console.error('Error summarizing thread:', error);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <Tabs defaultValue="comments" className="flex flex-col">
        <div className="border-b px-4 py-2.5">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="comments" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            {comments && comments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSummarize}
                disabled={summarizeThread.isPending}
              >
                {summarizeThread.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI Summary
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="comments" className="p-3 space-y-3">
          {summary && (
            <div className="rounded-lg border bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">AI Summary</span>
              </div>
              <p className="text-sm text-muted-foreground">{summary}</p>
            </div>
          )}

          {commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments && comments.length > 0 ? (
            comments.map((comment) => {
              const authorName = comment.author.name || comment.author.email;
              const initials = authorName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://avatar.vercel.sh/${authorName}`} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{comment.content}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No comments yet. Be the first to comment!
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="p-3">
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => {
                const userName = activity.user?.name || activity.user?.email || 'Unknown';
                const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

                let activityText = '';
                if (activity.type === 'created') {
                  activityText = 'Issue created';
                } else if (activity.type === 'updated' && activity.field) {
                  activityText = `${activity.field} changed`;
                  if (activity.oldValue && activity.newValue) {
                    activityText += ` from "${activity.oldValue}" to "${activity.newValue}"`;
                  } else if (activity.newValue) {
                    activityText += ` to "${activity.newValue}"`;
                  }
                } else if (activity.type === 'commented') {
                  activityText = 'Added a comment';
                } else {
                  activityText = activity.type;
                }

                return (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                    <div className="flex-1">
                      <p className="font-medium">{activityText}</p>
                      <p className="text-xs text-muted-foreground">
                        {userName} · {timeAgo}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No activity yet
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Comment Input */}
      <div className="border-t p-4">
        {issue?.organizationId && (
          <MentionTextarea
            value={newComment}
            onChange={setNewComment}
            onMention={(userId) => {
              if (!mentionedUsers.includes(userId)) {
                setMentionedUsers([...mentionedUsers, userId]);
              }
            }}
            placeholder="Add a comment... (Use @ to mention someone)"
            organizationId={issue.organizationId}
            className="min-h-[80px]"
          />
        )}
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={handleAddComment} disabled={createComment.isPending || !newComment.trim()}>
            {createComment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

