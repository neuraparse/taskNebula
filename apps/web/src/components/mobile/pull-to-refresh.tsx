'use client';

import { ReactNode, useState, useRef, TouchEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className,
}: PullToRefreshProps) {
  const t = useTranslations('mobileNav');
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: TouchEvent) => {
    // Only allow pull-to-refresh when scrolled to top
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      const touch = e.touches[0];
      if (touch) {
        touchStartY.current = touch.clientY;
        setCanPull(true);
      }
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!canPull || isRefreshing) return;

    const touch = e.touches[0];
    if (!touch) return;
    const touchY = touch.clientY;
    const distance = touchY - touchStartY.current;

    // Only pull down
    if (distance > 0) {
      // Apply resistance (diminishing returns)
      const resistance = 0.5;
      const adjustedDistance = Math.min(distance * resistance, threshold * 1.5);
      setPullDistance(adjustedDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!canPull || isRefreshing) return;

    setCanPull(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Error refreshing:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const rotation = (pullDistance / threshold) * 360;

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 top-0 z-10 flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-1.5">
          <RefreshCw
            className={cn(
              'text-primary h-5 w-5 transition-transform',
              isRefreshing && 'animate-spin'
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            }}
          />
          <span className="text-muted-foreground text-[11px]">
            {isRefreshing
              ? t('refreshing')
              : pullDistance >= threshold
                ? t('releaseToRefresh')
                : t('pullToRefresh')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
