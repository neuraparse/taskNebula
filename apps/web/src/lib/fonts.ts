/**
 * Typography — next/font definitions.
 *
 * The existing brand stack (Plus Jakarta Sans + JetBrains Mono) is wired in
 * via globals.css `@font-face` rules and `--font-sans` / `--font-mono`
 * variables. This module additionally exposes Vercel's Geist family via
 * `next/font/google` behind a feature flag so we can opt in to it surface by
 * surface without changing the existing look-and-feel.
 *
 * Usage:
 *   import { brandFont, geistFont, isGeistEnabled } from '@/lib/fonts';
 *
 *   <html className={isGeistEnabled() ? geistFont.variable : brandFont.variable}>
 *
 * The default (no flag) keeps `--font-sans` resolving to Plus Jakarta Sans,
 * which is what TaskNebula has shipped since 0.2.x.
 */
import { Geist, Geist_Mono, Inter } from 'next/font/google';

/**
 * Inter — a safe fallback if Plus Jakarta Sans assets ever fail to load.
 * Exposed via `--font-sans-fallback`; not applied by default.
 */
export const brandFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-fallback',
});

/**
 * Geist Sans (Vercel) — opt-in modern UI font. Exposes `--font-geist-sans`.
 */
export const geistFont = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
});

/**
 * Geist Mono — pairs with Geist Sans for monospace numerals + code.
 */
export const geistMonoFont = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

/**
 * Feature flag: render the app with Geist instead of the brand stack.
 *
 * Source of truth is the `NEXT_PUBLIC_UI_FONT` env var:
 *   - `geist`  → use Geist Sans + Geist Mono
 *   - anything else / unset → keep Plus Jakarta Sans (current default)
 *
 * Reading from `process.env` keeps this evaluable both server- and
 * client-side without pulling in the org-scoped feature-flags table (which
 * lives in the db) for a purely cosmetic toggle.
 */
export function isGeistEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UI_FONT === 'geist';
}
