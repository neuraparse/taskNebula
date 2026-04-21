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
        className={cn(
          'relative bg-background',
          isAnimating && 'transition-transform duration-300'
        )}
        style={{ transform: `translateX(${offset}px)` }}
        {...swipeHandlers}
      >
        {children}
      </div>
    </div>
  );
}

// Predefined actions using design token colors
export const swipeActions = {
  delete: (onClick: () => void): SwipeAction => ({
    icon: <Trash2 className="h-5 w-5 text-white" />,
    label: 'Delete',
    color: 'bg-destructive',
    onClick,
  }),
  archive: (onClick: () => void): SwipeAction => ({
    icon: <Archive className="h-5 w-5 text-white" />,
    label: 'Archive',
    color: 'bg-accent-amber',
    onClick,
  }),
  complete: (onClick: () => void): SwipeAction => ({
    icon: <Check className="h-5 w-5 text-white" />,
    label: 'Complete',
    color: 'bg-accent-emerald',
    onClick,
  }),
};
