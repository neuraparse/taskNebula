'use client';

import { Plus, StickyNote as StickyNoteIcon } from 'lucide-react';
import { type ReactElement, useCallback } from 'react';

import { StickyNote } from '@/components/personal/sticky-note';
import { useStickies } from '@/lib/personal/use-stickies';
import { cn } from '@/lib/utils';

export interface StickiesWidgetProps {
  className?: string;
  columns?: number;
}

export function StickiesWidget({
  className,
  columns,
}: StickiesWidgetProps): ReactElement | null {
  const { stickies, hydrated, addSticky, updateSticky, removeSticky } = useStickies();

  const handleAdd = useCallback(() => {
    addSticky();
  }, [addSticky]);

  // SSR-safe: render a lightweight skeleton before hydration so server/client match
  if (!hydrated) {
    return (
      <section
        aria-busy="true"
        aria-label="Stickies"
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4',
          className
        )}
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNoteIcon className="h-4 w-4 text-foreground/60" />
            <h3 className="text-sm font-semibold text-foreground">Stickies</h3>
          </div>
          <span className="h-6 w-6 rounded-md bg-muted/40" aria-hidden="true" />
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
          <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
          <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
        </div>
      </section>
    );
  }

  const gridStyle =
    typeof columns === 'number' && columns > 0
      ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
      : undefined;

  const isEmpty = stickies.length === 0;

  return (
    <section
      aria-label="Stickies"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4',
        className
      )}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNoteIcon className="h-4 w-4 text-foreground/60" />
          <h3 className="text-sm font-semibold text-foreground">Stickies</h3>
          {!isEmpty ? (
            <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/60">
              {stickies.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="Add sticky"
          title="Add sticky"
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-md',
            'text-foreground/60 transition-colors hover:bg-muted hover:text-foreground'
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
          <StickyNoteIcon className="h-6 w-6 text-foreground/40" />
          <p className="text-sm text-foreground/60">No stickies yet</p>
          <button
            type="button"
            onClick={handleAdd}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium',
              'text-foreground/80 transition-colors hover:bg-muted hover:text-foreground'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Add a sticky
          </button>
        </div>
      ) : gridStyle ? (
        <div className="grid gap-3" style={gridStyle}>
          {stickies.map((sticky) => (
            <StickyNote
              key={sticky.id}
              sticky={sticky}
              onUpdate={updateSticky}
              onRemove={removeSticky}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {stickies.map((sticky) => (
            <StickyNote
              key={sticky.id}
              sticky={sticky}
              onUpdate={updateSticky}
              onRemove={removeSticky}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default StickiesWidget;
