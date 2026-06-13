'use client';

import { ReactNode, useState } from 'react';
import { Trash2, Archive, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipe } from '@/hooks/use-swipe';

interface SwipeAction {
  icon: ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

interface SwipeableItemProps {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  className?: string;
}

export function SwipeableItem({
  children,
  leftAction,
  rightAction,
  className,
}: SwipeableItemProps) {
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (rightAction) {
        setIsAnimating(true);
        setOffset(-100);
        setTimeout(() => {
          rightAction.onClick();
          resetPosition();
        }, 300);
      }
    },
    onSwipeRight: () => {
      if (leftAction) {
        setIsAnimating(true);
        setOffset(100);
        setTimeout(() => {
          leftAction.onClick();
          resetPosition();
        }, 300);
      }
    },
  });

  const resetPosition = () => {
    setTimeout(() => {
      setOffset(0);
      setIsAnimating(false);
    }, 100);
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Left action reveal */}
      {leftAction && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start px-4',
            leftAction.color
          )}
          style={{ width: '100px' }}
          aria-label={leftAction.label}
        >
          {leftAction.icon}
        </div>
      )}

      {/* Right action reveal */}
      {rightAction && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end px-4',
            rightAction.color
          )}
          style={{ width: '100px' }}
          aria-label={rightAction.label}
        >
          {rightAction.icon}
        </div>
      )}

      {/* Content */}
      <div
        className={cn('bg-background relative', isAnimating && 'transition-transform duration-300')}
        style={{ transform: `translateX(${offset}px)` }}
        {...swipeHandlers}
      >
        {children}
      </div>
    </div>
  );
}

// Predefined actions using design token colors.
// Callers pass an already-translated `label` (used for the action's aria-label),
// since these factories run outside React and cannot use translation hooks.
export const swipeActions = {
  delete: (onClick: () => void, label: string): SwipeAction => ({
    icon: <Trash2 className="text-destructive-foreground h-4 w-4" />,
    label,
    color: 'bg-destructive',
    onClick,
  }),
  archive: (onClick: () => void, label: string): SwipeAction => ({
    icon: <Archive className="text-background h-4 w-4" />,
    label,
    color: 'bg-accent-amber',
    onClick,
  }),
  complete: (onClick: () => void, label: string): SwipeAction => ({
    icon: <Check className="text-background h-4 w-4" />,
    label,
    color: 'bg-accent-emerald',
    onClick,
  }),
};
