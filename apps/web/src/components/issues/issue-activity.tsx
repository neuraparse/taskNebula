'use client';

import { useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, History, Loader2, Bot } from 'lucide-react';
import { useComments, useCreateComment } from '@/lib/hooks/use-comments';
import { useActivities } from '@/lib/hooks/use-activities';
import { useIssue } from '@/lib/hooks/use-issues';
import { CommentItem } from './comment-item';
import { MentionTextarea } from './mention-textarea';
import { formatDistanceToNow } from 'date-fns';

const COMMENT_LIMIT = 5;
const ACTIVITY_LIMIT = 7;

// Loose shape for runtime fields that may not be in the strict TS interfaces.
type MaybeAgentActor =
  | {
      id?: string;
      name?: string | null;
      email?: string | null;
      kind?: string | null;
    }
  | null
  | undefined;

type MaybeAgentRecord = {
  author?: MaybeAgentActor;
  user?: MaybeAgentActor;
  metadata?: { agentId?: string | null; agentName?: string | null } | null;
  type?: string | null;
  field?: string | null;
  newValue?: string | null;
  oldValue?: string | null;
};

function isAgentActor(actor: MaybeAgentActor): boolean {
  if (!actor) return false;
  if (actor.kind === 'agent') return true;
  if (actor.email && actor.email.toLowerCase().endsWith('@agent.tasknebula')) return true;
  if (actor.name && actor.name.toLowerCase().includes('cursor')) return true;
  return false;
}

function isAgentEvent(item: MaybeAgentRecord): boolean {
  if (!item) return false;
  if (item.metadata?.agentId) return true;
  if (isAgentActor(item.author) || isAgentActor(item.user)) return true;
  const verb = (item.type || '').toLowerCase();
  if (verb.includes('agent') || verb.includes('agent_run') || verb.includes('agent.run')) {
    return true;
  }
  // Assignment whose newValue is an agent-looking name.
  if (
    verb === 'updated' &&
    (item.field || '').toLowerCase() === 'assignee' &&
    item.newValue &&
    item.newValue.toLowerCase().includes('cursor')
  ) {
    return true;
  }
  return false;
}

function getAgentName(item: MaybeAgentRecord): string {
  return (
    item.metadata?.agentName || item.newValue || item.author?.name || item.user?.name || 'Agent'
  );
}

export function IssueActivity({ issueId }: { issueId: string }) {
  const [newComment, setNewComment] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const { data: issue } = useIssue(issueId);
  const { data: comments, isLoading: commentsLoading } = useComments(issueId);
  const { data: activities, isLoading: activitiesLoading } = useActivities(issueId);
  const createComment = useCreateComment(issueId);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({ content: newComment.trim(), mentions: mentionedUsers });
      setNewComment('');
      setMentionedUsers([]);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const visibleComments = showAllComments
    ? comments || []
    : (comments || []).slice(0, COMMENT_LIMIT);
  const visibleActivities = showAllActivity
    ? activities || []
    : (activities || []).slice(0, ACTIVITY_LIMIT);

  return (
    <section className="animate-fade-in">
      <Tabs defaultValue="comments" className="flex flex-col">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="comments" className="gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments {comments && comments.length > 0 ? `(${comments.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="mt-0 space-y-4">
          {commentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            </div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {visibleComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  issueId={issueId}
                  currentUserId={currentUserId}
                  isAgent={isAgentActor(comment.author as MaybeAgentActor)}
                />
              ))}
              {comments.length > COMMENT_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllComments(!showAllComments)}
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors duration-200"
                >
                  {showAllComments
                    ? 'Show fewer'
                    : `Show ${comments.length - COMMENT_LIMIT} more comments`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-sm">No comments yet</p>
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
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                // Find index of the most recent agent-assignment event so we
                // can render the "Connected with X • Awaiting response" strip
                // immediately after it (only if no later reply from the agent).
                let connectedStripIndex = -1;
                let connectedAgentName = '';
                for (let i = visibleActivities.length - 1; i >= 0; i--) {
                  const a = visibleActivities[i] as unknown as MaybeAgentRecord;
                  const isAssign =
                    (a.type || '').toLowerCase() === 'updated' &&
                    (a.field || '').toLowerCase() === 'assignee';
                  const targetIsAgent = !!a.newValue && a.newValue.toLowerCase().includes('cursor');
                  if (isAssign && targetIsAgent) {
                    // Check no later agent comment/reply event after i.
                    const hasFollowup = visibleActivities.slice(i + 1).some((later) => {
                      const l = later as unknown as MaybeAgentRecord;
                      return (
                        isAgentEvent(l) &&
                        ((l.type || '').toLowerCase() === 'commented' ||
                          (l.type || '').toLowerCase().includes('agent'))
                      );
                    });
                    if (!hasFollowup) {
                      connectedStripIndex = i;
                      connectedAgentName = getAgentName(a);
                    }
                    break;
                  }
                }

                return visibleActivities.map((activity, idx) => {
                  const userName = activity.user?.name || activity.user?.email || 'Unknown';
                  const actorIsAgent = isAgentActor(activity.user as MaybeAgentActor);
                  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                  });

                  const isAssignment =
                    (activity.type || '').toLowerCase() === 'updated' &&
                    (activity.field || '').toLowerCase() === 'assignee';
                  const assignmentTargetIsAgent =
                    isAssignment &&
                    !!activity.newValue &&
                    activity.newValue.toLowerCase().includes('cursor');

                  let activityNode: ReactNode = null;
                  if (isAssignment && assignmentTargetIsAgent) {
                    activityNode = (
                      <span>
                        {userName} assigned to{' '}
                        <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11.5px] font-medium text-violet-700">
                          <Bot className="h-3 w-3" />
                          {activity.newValue}
                        </span>
                      </span>
                    );
                  } else {
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
                    activityNode = (
                      <>
                        <span className="text-foreground/80">{activityText}</span>
                        <span className="text-muted-foreground ml-2 text-[11px]">
                          {userName}
                          {actorIsAgent && (
                            <span className="ml-1 rounded-full bg-violet-100 px-1.5 align-middle text-[9px] font-semibold tracking-wider text-violet-700">
                              AGENT
                            </span>
                          )}
                          {' · '}
                          {timeAgo}
                        </span>
                      </>
                    );
                  }

                  return (
                    <div key={activity.id}>
                      <div className="flex gap-2.5 text-sm">
                        {actorIsAgent || (isAssignment && assignmentTargetIsAgent) ? (
                          <div className="bg-gradient-primary mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white">
                            <Bot className="h-2.5 w-2.5" />
                          </div>
                        ) : (
                          <div className="bg-muted-foreground/40 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"></div>
                        )}
                        <div className="flex-1">{activityNode}</div>
                      </div>
                      {idx === connectedStripIndex && (
                        <div className="border-border bg-muted/30 my-3 flex items-center justify-between rounded-lg border px-3 py-2 text-[12px]">
                          <div className="flex items-center gap-2">
                            <Bot className="h-3.5 w-3.5 text-violet-500" />
                            <span>
                              Connected with{' '}
                              <span className="text-foreground font-medium">
                                {connectedAgentName}
                              </span>
                            </span>
                            <span className="text-amber-600">• Awaiting response</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              // Best-effort: dispatch a window event so any AI sidecar
                              // listener can toggle. No-op if no listener.
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('tasknebula:open-ai-sidecar'));
                              }
                            }}
                            className="text-foreground font-medium hover:underline"
                          >
                            Open sidecar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {activities.length > ACTIVITY_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors duration-200"
                >
                  {showAllActivity
                    ? 'Show fewer'
                    : `Show ${activities.length - ACTIVITY_LIMIT} more`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-sm">No activity yet</p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
