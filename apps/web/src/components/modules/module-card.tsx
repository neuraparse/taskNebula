'use client';

import { CalendarClock, Users, ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectModule, ModuleStatus } from '@/lib/modules/use-modules';

interface ModuleCardProps {
  module: ProjectModule;
  onClick?: () => void;
}

interface StatusPalette {
  labelKey: string;
  dot: string;
  badge: string;
}

const STATUS_PALETTE: Record<ModuleStatus, StatusPalette> = {
  backlog: {
    labelKey: 'status_backlog',
    dot: 'bg-muted-foreground/60',
    badge: 'bg-muted text-muted-foreground border-border',
  },
  planned: {
    labelKey: 'status_planned',
    dot: 'bg-accent-blue',
    badge: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  },
  in_progress: {
    labelKey: 'status_in_progress',
    dot: 'bg-accent-amber',
    badge: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
  },
  paused: {
    labelKey: 'status_paused',
    dot: 'bg-slate-400',
    badge: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  },
  completed: {
    labelKey: 'status_completed',
    dot: 'bg-accent-emerald',
    badge: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
  },
  cancelled: {
    labelKey: 'status_cancelled',
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
  const t = useTranslations('planning');
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
    console.info(`[modules] navigate → /projects/${module.projectId}/modules/${module.id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'border-border bg-card group w-full rounded-xl border p-4 text-left',
        'ease-snap transition-all duration-150',
        'hover:border-border/80 hover:-translate-y-0.5 hover:shadow-md',
        'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
      )}
    >
      {/* Top row: status dot + name + lead avatar */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', palette.dot)}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{module.name}</span>
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full',
            'bg-muted text-muted-foreground shrink-0 text-[10px] font-medium'
          )}
          title={module.leadName ?? t('unassigned')}
          aria-label={module.leadName ? t('lead_aria', { name: module.leadName }) : t('unassigned')}
        >
          {initials(module.leadName)}
        </span>
      </div>

      {/* Description (1 line, muted) */}
      {module.description ? (
        <p className="text-muted-foreground mt-2 truncate text-xs">{module.description}</p>
      ) : (
        <p className="text-muted-foreground/60 mt-2 truncate text-xs italic">
          {t('no_description')}
        </p>
      )}

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="bg-primary/10 h-1.5 flex-1 overflow-hidden rounded-sm">
          <div
            className="bg-primary ease-snap h-full rounded-sm transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
          <ListChecks className="-mt-0.5 mr-0.5 inline h-3 w-3" />
          {completed}/{total}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {targetLabel && (
            <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
              <CalendarClock className="h-3 w-3" />
              {targetLabel}
            </span>
          )}
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
            <Users className="h-3 w-3" />
            {module.memberIds.length}
          </span>
        </div>
        <Badge variant="outline" className={cn('border', palette.badge)}>
          {t(palette.labelKey)}
        </Badge>
      </div>
    </button>
  );
}
