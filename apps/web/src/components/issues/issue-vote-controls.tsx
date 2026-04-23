'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';

export type IssueVote = 'up' | 'down' | null;

export interface IssueVoteControlsProps {
  upvotes: number;
  downvotes: number;
  userVote?: IssueVote;
  onVote?: (vote: IssueVote) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  sm: {
    button: 'h-6 w-6',
    icon: 'h-3.5 w-3.5',
    count: 'text-xs',
  },
  md: {
    button: 'h-8 w-8',
    icon: 'h-4 w-4',
    count: 'text-sm',
  },
} as const;

export function IssueVoteControls({
  upvotes,
  downvotes,
  userVote = null,
  onVote,
  size = 'md',
  className,
}: IssueVoteControlsProps) {
  const dims = sizeMap[size];
  const score = upvotes - downvotes;

  const handle = React.useCallback(
    (next: Exclude<IssueVote, null>) => {
      const resolved: IssueVote = userVote === next ? null : next;
      onVote?.(resolved);
    },
    [onVote, userVote],
  );

  const isUp = userVote === 'up';
  const isDown = userVote === 'down';

  const scoreColor = isUp
    ? 'text-primary'
    : isDown
      ? 'text-destructive'
      : 'text-foreground';

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-background/40 px-1 py-1',
        className,
      )}
      role="group"
      aria-label="Vote"
    >
      <button
        type="button"
        onClick={() => handle('up')}
        aria-label={isUp ? 'Remove upvote' : 'Upvote'}
        aria-pressed={isUp}
        className={cn(
          'inline-flex items-center justify-center rounded-sm transition-colors duration-150',
          'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          dims.button,
          isUp ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <ChevronUp className={dims.icon} />
      </button>

      <span
        className={cn(
          'tabular-nums font-medium leading-none select-none',
          dims.count,
          scoreColor,
        )}
        aria-live="polite"
        aria-label={`Score ${score}, ${upvotes} upvotes, ${downvotes} downvotes`}
      >
        {score}
      </span>

      <button
        type="button"
        onClick={() => handle('down')}
        aria-label={isDown ? 'Remove downvote' : 'Downvote'}
        aria-pressed={isDown}
        className={cn(
          'inline-flex items-center justify-center rounded-sm transition-colors duration-150',
          'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          dims.button,
          isDown ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        <ChevronDown className={dims.icon} />
      </button>
    </div>
  );
}

export default IssueVoteControls;
