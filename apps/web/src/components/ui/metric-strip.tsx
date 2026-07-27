import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MetricStripItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

interface MetricStripProps {
  items: MetricStripItem[];
  className?: string;
}

export function MetricStrip({ items, className }: MetricStripProps) {
  return (
    <dl
      className={cn(
        'surface-card bg-border grid grid-cols-2 gap-px overflow-hidden shadow-none md:grid-cols-4',
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-card flex min-h-[72px] min-w-0 flex-col justify-center gap-1 p-3"
        >
          <dt className="text-muted-foreground truncate text-[11px] font-medium uppercase">
            {item.label}
          </dt>
          <dd className="text-foreground text-2xl font-medium tabular-nums leading-none">
            {item.value}
          </dd>
          {item.hint ? (
            <dd className="text-muted-foreground truncate text-[11px]">{item.hint}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
