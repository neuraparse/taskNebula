'use client';

import * as React from 'react';
import { BellPlus, BellRing } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarStack,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface IssueSubscriber {
  id: string;
  name?: string;
  avatarUrl?: string;
}

export interface IssueSubscribeButtonProps {
  subscribed: boolean;
  subscriberCount?: number;
  subscribers?: IssueSubscriber[];
  onToggle?: () => void;
  showCount?: boolean;
  className?: string;
}

function initialsOf(name?: string): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function IssueSubscribeButton({
  subscribed,
  subscriberCount,
  subscribers,
  onToggle,
  showCount = true,
  className,
}: IssueSubscribeButtonProps) {
  const Icon = subscribed ? BellRing : BellPlus;
  const label = subscribed ? 'Subscribed' : 'Subscribe';

  const resolvedCount =
    typeof subscriberCount === 'number'
      ? subscriberCount
      : subscribers?.length ?? 0;

  const handleClick = React.useCallback(() => {
    onToggle?.();
  }, [onToggle]);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Button
        type="button"
        variant={subscribed ? 'secondary' : 'outline'}
        size="sm"
        onClick={handleClick}
        aria-pressed={subscribed}
        aria-label={subscribed ? 'Unsubscribe from issue' : 'Subscribe to issue'}
        className={cn(
          'gap-1.5',
          subscribed && 'text-primary',
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        {showCount && resolvedCount > 0 ? (
          <span
            className={cn(
              'ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums',
              subscribed
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
            aria-label={`${resolvedCount} subscribers`}
          >
            {resolvedCount}
          </span>
        ) : null}
      </Button>

      {subscribers && subscribers.length > 0 ? (
        <AvatarStack size="sm" max={3} aria-label="Subscribers">
          {subscribers.map((subscriber) => (
            <Avatar key={subscriber.id} size="sm">
              {subscriber.avatarUrl ? (
                <AvatarImage
                  src={subscriber.avatarUrl}
                  alt={subscriber.name ?? 'Subscriber'}
                />
              ) : null}
              <AvatarFallback>{initialsOf(subscriber.name)}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarStack>
      ) : null}
    </div>
  );
}

export default IssueSubscribeButton;
