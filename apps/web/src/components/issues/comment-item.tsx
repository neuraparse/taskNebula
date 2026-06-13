'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { Bot, Loader2, Pencil, SmilePlus, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  COMMENT_HAS_REPLIES_ERROR,
  useDeleteComment,
  useToggleCommentReaction,
  useUpdateComment,
  type Comment,
  type CommentReaction,
} from '@/lib/hooks/use-comments';

/** Emoji allowlist — must stay in sync with the reactions API z.enum. */
const REACTION_EMOJIS = ['👍', '👎', '🎉', '❤️', '😄', '😕', '🚀', '👀'] as const;

interface ReactionGroup {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

function groupReactions(
  reactions: CommentReaction[] | undefined,
  currentUserId: string | null
): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const reaction of reactions ?? []) {
    const group = groups.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
    };
    group.count += 1;
    if (currentUserId && reaction.userId === currentUserId) {
      group.reactedByMe = true;
    }
    groups.set(reaction.emoji, group);
  }
  return Array.from(groups.values());
}

interface CommentItemProps {
  comment: Comment;
  issueId: string;
  currentUserId: string | null;
  isAgent: boolean;
}

export function CommentItem({ comment, issueId, currentUserId, isAgent }: CommentItemProps) {
  const t = useTranslations('issueDetail.comments');
  const { toast } = useToast();
  const updateComment = useUpdateComment(issueId);
  const deleteComment = useDeleteComment(issueId);
  const toggleReaction = useToggleCommentReaction(issueId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const authorName = comment.author.name || comment.author.email;
  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const isOwn = !!currentUserId && (comment.createdBy ?? comment.author.id) === currentUserId;
  const isEdited =
    comment.updatedAt != null &&
    new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime();
  const reactionGroups = groupReactions(comment.reactions, currentUserId);

  const startEdit = () => {
    setDraft(comment.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft('');
  };

  const saveEdit = async () => {
    const content = draft.trim();
    if (!content) return;
    if (content === comment.content) {
      cancelEdit();
      return;
    }
    try {
      await updateComment.mutateAsync({ commentId: comment.id, content });
      cancelEdit();
    } catch {
      toast({ title: t('updateFailed'), variant: 'destructive' });
    }
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void saveEdit();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment.mutateAsync(comment.id);
      setDeleteOpen(false);
    } catch (error) {
      setDeleteOpen(false);
      const hasReplies = error instanceof Error && error.message === COMMENT_HAS_REPLIES_ERROR;
      toast({
        title: hasReplies ? t('deleteBlockedReplies') : t('deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleToggleReaction = (emoji: string) => {
    if (!currentUserId) return;
    setPaletteOpen(false);
    toggleReaction.mutate(
      { commentId: comment.id, emoji, userId: currentUserId },
      {
        onError: () => toast({ title: t('reactionFailed'), variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="group flex gap-3">
      {isAgent ? (
        <div className="bg-gradient-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white">
          <Bot className="h-3.5 w-3.5" />
        </div>
      ) : (
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={`https://avatar.vercel.sh/${authorName}`} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{authorName}</span>
          {isAgent && (
            <span className="rounded-full bg-violet-100 px-1.5 text-[9px] font-semibold tracking-wider text-violet-700">
              {t('agentBadge')}
            </span>
          )}
          <span className="text-muted-foreground text-[11px]">{timeAgo}</span>
          {isEdited && <span className="text-muted-foreground/80 text-[11px]">{t('edited')}</span>}
          {!isAgent && isOwn && !isEditing && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground h-6 w-6"
                onClick={startEdit}
                aria-label={t('edit')}
                title={t('edit')}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Popover open={deleteOpen} onOpenChange={setDeleteOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive h-6 w-6"
                    aria-label={t('delete')}
                    title={t('delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-3">
                  <p className="text-sm font-medium">{t('deleteConfirmTitle')}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{t('deleteConfirmBody')}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDeleteOpen(false)}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleDelete}
                      disabled={deleteComment.isPending}
                    >
                      {deleteComment.isPending && (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      )}
                      {t('delete')}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className="min-h-[60px] text-sm"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-muted-foreground mr-auto text-[11px]">{t('editHint')}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cancelEdit}>
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => void saveEdit()}
                disabled={updateComment.isPending || !draft.trim()}
              >
                {updateComment.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              'text-foreground/90 mt-0.5 text-sm leading-relaxed',
              isAgent && 'mt-1 rounded-md border border-violet-100 bg-violet-50/40 px-2.5 py-1.5'
            )}
          >
            {comment.content}
          </p>
        )}

        {!isEditing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {reactionGroups.map((group) => (
              <button
                key={`${comment.id}-${group.emoji}`}
                type="button"
                onClick={() => handleToggleReaction(group.emoji)}
                aria-pressed={group.reactedByMe}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors duration-200',
                  group.reactedByMe
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <span>{group.emoji}</span>
                <span className="tabular-nums">{group.count}</span>
              </button>
            ))}
            <Popover open={paletteOpen} onOpenChange={setPaletteOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t('addReaction')}
                  title={t('addReaction')}
                  className={cn(
                    'border-border text-muted-foreground hover:bg-accent hover:text-foreground inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs transition-colors duration-200',
                    reactionGroups.length === 0 &&
                      !paletteOpen &&
                      'opacity-0 focus-visible:opacity-100 group-hover:opacity-100'
                  )}
                >
                  <SmilePlus className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-1.5">
                <div className="flex gap-0.5">
                  {REACTION_EMOJIS.map((emoji) => {
                    const mine = reactionGroups.some(
                      (group) => group.emoji === emoji && group.reactedByMe
                    );
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleToggleReaction(emoji)}
                        aria-pressed={mine}
                        className={cn(
                          'hover:bg-accent rounded-md p-1 text-base leading-none transition-colors duration-150',
                          mine && 'bg-primary/10'
                        )}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
}
