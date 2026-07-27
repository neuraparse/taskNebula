import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageFrameProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageFrame({ children, className, contentClassName }: PageFrameProps) {
  return (
    <div
      className={cn(
        'bg-background flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
        className
      )}
    >
      <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div
          className={cn(
            'mx-auto w-full min-w-0 max-w-[1520px] space-y-4 p-3 sm:p-4 lg:p-5',
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
