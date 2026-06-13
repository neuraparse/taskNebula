import * as React from 'react';

import { cn } from '@/lib/utils';

export type LabelTone =
  | 'orange'
  | 'emerald'
  | 'blue'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'cyan'
  | 'slate';

export const LABEL_TONES: LabelTone[] = [
  'orange',
  'emerald',
  'blue',
  'amber',
  'rose',
  'violet',
  'cyan',
  'slate',
];

interface ToneStyles {
  pill: string;
  dot: string;
}

const TONE_STYLES: Record<LabelTone, ToneStyles> = {
  orange: { pill: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  emerald: { pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  blue: { pill: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  amber: { pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  rose: { pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  violet: { pill: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  cyan: { pill: 'bg-cyan-50 text-cyan-700', dot: 'bg-cyan-500' },
  slate: { pill: 'bg-muted text-foreground', dot: 'bg-slate-500' },
};

/**
 * Stable tone derivation from an arbitrary string seed.
 * Sums character codes modulo the number of available tones.
 */
export function hashTone(seed: string): LabelTone {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) {
    sum += seed.charCodeAt(i);
  }
  const index = sum % LABEL_TONES.length;
  return LABEL_TONES[index]!;
}

export interface LabelPillProps {
  label: string;
  tone?: LabelTone;
  hashSeed?: string;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
}

export function LabelPill({
  label,
  tone,
  hashSeed,
  size = 'sm',
  className,
  onClick,
}: LabelPillProps) {
  const resolvedTone: LabelTone = tone ?? (hashSeed ? hashTone(hashSeed) : hashTone(label));
  const styles = TONE_STYLES[resolvedTone];

  const sizeClass = size === 'md' ? 'h-5 text-[12px] gap-1.5' : 'h-[18px] text-[11.5px] gap-1';

  const interactive = typeof onClick === 'function';

  const baseClass = cn(
    'inline-flex items-center rounded-full px-2 font-medium leading-none whitespace-nowrap select-none',
    sizeClass,
    styles.pill,
    interactive && 'cursor-pointer transition-colors hover:brightness-95',
    className
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        <span
          aria-hidden="true"
          className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)}
        />
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <span className={baseClass}>
      <span
        aria-hidden="true"
        className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export interface LabelPillGroupProps {
  labels: string[];
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function LabelPillGroup({ labels, max = 3, size = 'sm', className }: LabelPillGroupProps) {
  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;

  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {visible.map((label) => (
        <LabelPill key={label} label={label} hashSeed={label} size={size} />
      ))}
      {overflow > 0 ? <LabelPill label={`+${overflow} more`} tone="slate" size={size} /> : null}
    </div>
  );
}
