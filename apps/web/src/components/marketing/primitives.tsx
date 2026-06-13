import type { ReactNode } from 'react';

/**
 * Shared layout primitives for the marketing landing page.
 *
 * Server-safe (no hooks, no state) — every section component composes these so
 * the page keeps one container rhythm and one typographic voice. Colors go
 * through the `--landing-*` tokens scoped by `.landing-dark` in globals.css.
 */

export const GITHUB_URL = 'https://github.com/neuraparse/tasknebula';
export const DOCKER_HUB_URL = 'https://hub.docker.com/r/neuraparse/tasknebula';

export function Shell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-screen-xl px-4 sm:px-8 lg:px-20 ${className}`}>
      {children}
    </div>
  );
}

export function Kicker({
  label,
  accentVar,
  center = false,
}: {
  label: string;
  accentVar: string;
  center?: boolean;
}) {
  return (
    <span
      className={`landing-kicker inline-flex items-center gap-2 text-[var(--landing-text-subtle)] ${
        center ? 'justify-center' : ''
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentVar }} />
      {label}
    </span>
  );
}

export function SectionHeader({
  kicker,
  kickerAccentVar,
  title,
  description,
  compact = false,
}: {
  kicker: string;
  kickerAccentVar: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'max-w-2xl' : 'max-w-3xl'}>
      <Kicker label={kicker} accentVar={kickerAccentVar} />
      <h2
        className={`landing-title mt-5 text-balance text-[var(--landing-text-dark)] ${
          compact ? 'text-[30px] sm:text-[36px]' : 'text-[34px] sm:text-[42px] lg:text-[52px]'
        }`}
      >
        {title}
      </h2>
      <p className="landing-body mt-4 max-w-2xl text-[15px] text-[var(--landing-text-subtle)] sm:text-[16px]">
        {description}
      </p>
    </div>
  );
}

/** Shared brand-colored focus ring — matches the landing showcase idiom. */
export const focusRingClass =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--landing-accent-blue)]';

/** Canonical primary CTA classes — keep in sync with the app-wide idiom. */
export const primaryCtaClass = `inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-[430] text-primary-foreground transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:shadow-glow-primary hover:opacity-95 ${focusRingClass}`;

/** Canonical secondary (outline) CTA classes. */
export const secondaryCtaClass = `inline-flex h-11 items-center gap-2 rounded-md border border-[var(--landing-border-strong)] px-4 text-sm font-[430] text-[var(--landing-text)] transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:bg-[var(--landing-bg-elevated)] ${focusRingClass}`;
