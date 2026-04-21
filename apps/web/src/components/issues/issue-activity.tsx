'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Loader2 } from 'lucide-react';
import { useComments, useCreateComment } from '@/lib/hooks/use-comments';
import { useActivities } from '@/lib/hooks/use-activities';
import { useIssue } from '@/lib/hooks/use-issues';
import { MentionTextarea } from './mention-textarea';
import { formatDistanceToNow } from 'date-fns';

const COMMENT_LIMIT = 5;
const ACTIVITY_LIMIT = 7;

export function IssueActivity({ issueId }: { issueId: string }) {
  const [newComment, setNewComment] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const { data: issue } = useIssue(issueId);
  const { data: comments, isLoading: commentsLoading } = useComments(issueId);
  const { data: activities, isLoading: activitiesLoading } = useActivities(issueId);
  const createComment = useCreateComment(issueId);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync(newComment.trim());
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const visibleComments = showAllComments ? (comments || []) : (comments || []).slice(0, COMMENT_LIMIT);
  const visibleActivities = showAllActivity ? (activities || []) : (activities || []).slice(0, ACTIVITY_LIMIT);

  return (
    <section className="animate-fade-in">
      <Tabs defaultValue="comments" className="flex flex-col">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="comments" className="gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments {comments && comments.length > 0 ? `(${comments.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="space-y-4 mt-0">
          {commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {visibleComments.map((comment) => {
                const authorName = comment.author.name || comment.author.email;
                const initials = authorName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={`https://avatar.vercel.sh/${authorName}`} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-sm">{authorName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                );
              })}
              {comments.length > COMMENT_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllComments(!showAllComments)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {showAllComments ? 'Show fewer' : `Show ${comments.length - COMMENT_LIMIT} more comments`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No comments yet
            </p>
          )}

          {/* Comment Input */}
          <div className="pt-2">
            {issue?.organizationId && (
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                onMention={(userId) => {
                  if (!mentionedUsers.includes(userId)) {
                    setMentionedUsers([...mentionedUsers, userId]);
                  }
                }}
                placeholder="Write a comment... (@ to mention)"
                organizationId={issue.organizationId}
                className="min-h-[72px] text-sm"
              />
            )}
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddComment}
                disabled={createComment.isPending || !newComment.trim()}
              >
                {createComment.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Comment
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-3">
              {visibleActivities.map((activity) => {
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
                  <div key={activity.id} className="flex gap-2.5 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0"></div>
                    <div className="flex-1">
                      <span className="text-foreground/80">{activityText}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        {userName} · {timeAgo}
                      </span>
                    </div>
                  </div>
                );
              })}
              {activities.length > ACTIVITY_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {showAllActivity ? 'Show fewer' : `Show ${activities.length - ACTIVITY_LIMIT} more`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No activity yet
            </p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
