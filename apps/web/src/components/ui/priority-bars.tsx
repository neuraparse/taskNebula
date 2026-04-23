import * as React from 'react';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface PriorityBarsProps {
  level: PriorityLevel;
  size?: number;
  className?: string;
}

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

export const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  urgent: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#6B7280',
  none: '#9CA3AF',
};

const MUTED = '#D1D5DB';

interface BarSpec {
  x: number;
  y: number;
  height: number;
}

const BARS: readonly BarSpec[] = [
  { x: 2, y: 10, height: 4 },
  { x: 7, y: 6, height: 8 },
  { x: 12, y: 2, height: 12 },
] as const;

interface BarStyle {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

function getBarStyles(level: PriorityLevel): readonly [BarStyle, BarStyle, BarStyle] {
  switch (level) {
    case 'urgent': {
      const filled: BarStyle = { fill: PRIORITY_COLOR.urgent };
      return [filled, filled, filled];
    }
    case 'high': {
      const filled: BarStyle = { fill: PRIORITY_COLOR.high };
      return [filled, filled, filled];
    }
    case 'medium': {
      const filled: BarStyle = { fill: PRIORITY_COLOR.medium };
      const muted: BarStyle = { fill: MUTED };
      return [muted, filled, filled];
    }
    case 'low': {
      const filled: BarStyle = { fill: PRIORITY_COLOR.low };
      const muted: BarStyle = { fill: MUTED };
      return [muted, muted, filled];
    }
    case 'none':
    default: {
      const empty: BarStyle = {
        fill: 'none',
        stroke: MUTED,
        strokeWidth: 1,
      };
      return [empty, empty, empty];
    }
  }
}

export const PriorityBars: React.FC<PriorityBarsProps> = ({
  level,
  size = 14,
  className,
}) => {
  const styles = getBarStyles(level);
  const label = PRIORITY_LABELS[level];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      role="img"
      aria-label={`${label} priority`}
      className={className}
    >
      {BARS.map((bar, index) => {
        const style = styles[index] ?? { fill: '#D1D5DB', stroke: '#D1D5DB', strokeWidth: 0 };
        return (
          <rect
            key={`${bar.x}-${bar.y}`}
            x={bar.x}
            y={bar.y}
            width={3}
            height={bar.height}
            rx={0.5}
            ry={0.5}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
          />
        );
      })}
      {level === 'urgent' && (
        <g aria-hidden="true">
          <circle cx={13.5} cy={2.5} r={2.25} fill={PRIORITY_COLOR.urgent} />
          <rect x={13.15} y={1.25} width={0.7} height={1.6} rx={0.25} fill="#FFFFFF" />
          <circle cx={13.5} cy={3.5} r={0.4} fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
};

PriorityBars.displayName = 'PriorityBars';

export default PriorityBars;
