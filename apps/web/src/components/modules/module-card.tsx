'use client';

import { CalendarClock, Users, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectModule, ModuleStatus } from '@/lib/modules/use-modules';

interface ModuleCardProps {
  module: ProjectModule;
  onClick?: () => void;
}

interface StatusPalette {
  label: string;
  dot: string;
  badge: string;
}

const STATUS_PALETTE: Record<ModuleStatus, StatusPalette> = {
  backlog: {
    label: 'Backlog',
    dot: 'bg-muted-foreground/60',
    badge: 'bg-muted text-muted-foreground border-border',
  },
  planned: {
    label: 'Planned',
    dot: 'bg-accent-blue',
    badge: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  },
  in_progress: {
    label: 'In progress',
    dot: 'bg-accent-amber',
    badge: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-slate-400',
    badge: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-accent-emerald',
    badge: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  },
};

export function getModuleStatusPalette(status: ModuleStatus): StatusPalette {
  return STATUS_PALETTE[status];
}

function formatTargetDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export function ModuleCard({ module, onClick }: ModuleCardProps) {
  const palette = STATUS_PALETTE[module.status];
  const total = module.totalIssues ?? 0;
  const completed = module.completedIssues ?? 0;
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const targetLabel = formatTargetDate(module.targetDate);

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    // eslint-disable-next-line no-console
    console.info(
      `[modules] navigate → /projects/${module.projectId}/modules/${module.id}`,
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group w-full text-left rounded-xl border border-border bg-card p-4',
        'transition-all duration-150 ease-snap',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-border/80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      {/* Top row: status dot + name + lead avatar */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn('inline-block h-2 w-2 rounded-full shrink-0', palette.dot)}
          aria-hidden
        />
        <span className="flex-1 min-w-0 truncate font-semibold text-sm">
          {module.name}
        </span>
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full',
            'bg-muted text-[10px] font-medium text-muted-foreground shrink-0',
          )}
          title={module.leadName ?? 'Unassigned'}
          aria-label={module.leadName ? `Lead: ${module.leadName}` : 'Unassigned'}
        >
          {initials(module.leadName)}
        </span>
      </div>

      {/* Description (1 line, muted) */}
      {module.description ? (
        <p className="mt-2 text-xs text-muted-foreground truncate">
          {module.description}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground/60 italic truncate">
          No description
        </p>
      )}

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 overflow-hidden rounded-sm bg-primary/10">
          <div
            className="h-full rounded-sm bg-primary transition-all duration-150 ease-snap"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          <ListChecks className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          {completed}/{total}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {targetLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {targetLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {module.memberIds.length}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn('border', palette.badge)}
        >
          {palette.label}
        </Badge>
      </div>
    </button>
  );
}
