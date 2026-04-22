import * as React from 'react';

export type WorkflowStatusKind =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export interface StatusIconProps {
  kind: WorkflowStatusKind;
  size?: number;
  className?: string;
}

export const STATUS_KIND_LABELS: Record<WorkflowStatusKind, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const COLORS = {
  backlog: '#9CA3AF',
  todo: '#6B7280',
  in_progress: '#F59E0B',
  done: '#10B981',
  cancelled: '#EF4444',
} as const;

/**
 * StatusIcon — Plane-style workflow status indicator.
 *
 * Renders a 16x16 SVG circle whose visual treatment depends on `kind`.
 * All variants share a unified viewBox (0 0 16 16) and stroke width (1.5)
 * so they line up cleanly when used inline next to text.
 */
export function StatusIcon({
  kind,
  size = 16,
  className,
}: StatusIconProps): React.ReactElement {
  const color = COLORS[kind];
  const label = STATUS_KIND_LABELS[kind];

  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    role: 'img',
    'aria-label': label,
  } as const;

  switch (kind) {
    case 'backlog':
      return (
        <svg {...commonProps}>
          <circle
            cx={8}
            cy={8}
            r={6.5}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="2 2"
            fill="none"
          />
        </svg>
      );

    case 'todo':
      return (
        <svg {...commonProps}>
          <circle
            cx={8}
            cy={8}
            r={6.5}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
          />
        </svg>
      );

    case 'in_progress': {
      // Half-fill arc spanning 45deg → 180deg (a 135deg slice).
      // Angles measured from 12 o'clock (top), clockwise.
      const cx = 8;
      const cy = 8;
      const r = 6.5;
      const toXY = (deg: number): [number, number] => {
        // Convert "from top, clockwise" to standard math radians.
        const rad = ((deg - 90) * Math.PI) / 180;
        return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
      };
      const [sx, sy] = toXY(45);
      const [ex, ey] = toXY(180);
      const largeArcFlag = 0; // 135deg sweep < 180
      const sweepFlag = 1; // clockwise
      const arcPath = `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${ex} ${ey} Z`;
      return (
        <svg {...commonProps}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
          />
          <path d={arcPath} fill={color} stroke="none" />
        </svg>
      );
    }

    case 'done':
      return (
        <svg {...commonProps}>
          <circle cx={8} cy={8} r={7.25} fill={color} />
          <path
            d="M4.5 8.25 L7 10.5 L11.5 5.75"
            stroke="#FFFFFF"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );

    case 'cancelled':
      return (
        <svg {...commonProps}>
          <circle cx={8} cy={8} r={7.25} fill={color} />
          <path
            d="M5.25 5.25 L10.75 10.75 M10.75 5.25 L5.25 10.75"
            stroke="#FFFFFF"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );

    default: {
      // Exhaustiveness guard for strict TS.
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export default StatusIcon;
