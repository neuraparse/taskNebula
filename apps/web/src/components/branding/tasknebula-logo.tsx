import type { SVGProps } from 'react';
import { useId } from 'react';

type TaskNebulaLogoProps = SVGProps<SVGSVGElement> & {
  compact?: boolean;
  /**
   * `brand` (default) — gradient app-tile mark, theme-agnostic.
   * `mono` — single-color outline variant driven by `currentColor`.
   */
  variant?: 'brand' | 'mono';
};

/**
 * TaskNebula mark: a rounded-square task tile with a checkmark whose plane is
 * crossed by a single orbit and two satellite nodes ("task + nebula").
 *
 * Brand gradient uses the app palette from `globals.css` — do not invent new
 * colors: `--primary` hsl(217 91% 60%) → #3B82F6 and `--accent-violet`
 * hsl(264 80% 62%) → #8F51EC. Hex literals are intentional so the mark stays
 * stable across `data-theme` palettes and light/dark mode.
 *
 * Geometry must stay in sync with the static assets in `public/icon.svg`,
 * `public/icons/*` and `src/app/{favicon.ico,apple-icon.png,opengraph-image.png}`.
 */
export function TaskNebulaLogo({
  compact = false,
  variant = 'brand',
  className,
  ...props
}: TaskNebulaLogoProps) {
  const size = compact ? 28 : 36;
  // Namespace gradient ids per instance so multiple logos on one page don't collide.
  const baseId = useId().replace(/:/g, '');
  const tileId = `${baseId}-tile`;
  const sheenId = `${baseId}-sheen`;

  if (variant === 'mono') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={className}
        {...props}
      >
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="21"
          rx="5.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="8.2"
          ry="3.3"
          transform="rotate(30 12 12)"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.5"
        />
        <path
          d="M7.1 12.5 10.6 15.9 17 8.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="18.55" cy="16.1" r="1.2" fill="currentColor" />
        <circle cx="5.45" cy="7.9" r="0.85" fill="currentColor" opacity="0.6" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={tileId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8F51EC" />
        </linearGradient>
        <radialGradient
          id={sheenId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(5 4) rotate(48) scale(22)"
        >
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Base brand tile */}
      <rect x="1" y="1" width="22" height="22" rx="6" fill={`url(#${tileId})`} />
      {/* Top-left inner sheen for depth */}
      <rect x="1" y="1" width="22" height="22" rx="6" fill={`url(#${sheenId})`} />
      {/* Crisp inner edge so the mark reads at small sizes */}
      <rect
        x="1.6"
        y="1.6"
        width="20.8"
        height="20.8"
        rx="5.4"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="0.85"
      />
      {/* Nebula orbit */}
      <ellipse
        cx="12"
        cy="12"
        rx="8.2"
        ry="3.3"
        transform="rotate(30 12 12)"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.1"
        opacity="0.5"
      />
      {/* Task checkmark */}
      <path
        d="M7.1 12.5 10.6 15.9 17 8.6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Primary satellite node on the orbit, with a soft halo */}
      <circle cx="18.55" cy="16.1" r="2.1" fill="#FFFFFF" opacity="0.25" />
      <circle cx="18.55" cy="16.1" r="1.2" fill="#FFFFFF" />
      {/* Trailing satellite */}
      <circle cx="5.45" cy="7.9" r="0.85" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}
