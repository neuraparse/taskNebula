import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  kicker?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, kicker, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex min-w-0 flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h1 className="text-foreground text-balance text-2xl font-medium leading-tight sm:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
