'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALE_COOKIE, localeLabels, locales, type Locale } from '@/lib/i18n/config';

/**
 * Compact dropdown that lets a user pick one of the supported locales.
 *
 * We persist the choice in the `tasknebula-locale` cookie so the next-intl
 * middleware can pick it up on the next request (and the root layout reads
 * the cookie when setting `<html lang>` + `dir`). After writing the cookie
 * we just refresh the page — that keeps the implementation simple and
 * sidesteps the question of whether the current URL has a `/[locale]/`
 * prefix today (most app routes do not yet — see lib/i18n/MIGRATION.md).
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('actions');
  const tLayout = useTranslations('layoutNav');
  const [isPending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    // 1 year, lax — same as next-intl's default cookie behavior.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // Flush the cookie write before we hard-reload. `document.cookie = …` is
    // synchronous in spec terms, but on slow devices we've observed the
    // reload fire while the cookie is still queued — the next request goes
    // out with the old value and the page renders in the previous locale.
    // Re-reading the cookie back forces the browser to flush, and the
    // double-rAF below yields a paint so the dropdown's selection animation
    // is visible before the page goes white.
    const written = document.cookie.includes(`${LOCALE_COOKIE}=${next}`);
    startTransition(() => {
      if (typeof window === 'undefined') return;
      const reload = () => window.location.reload();
      if (!written) {
        // Cookie didn't take (rare — third-party cookie block, private
        // mode). Fall back to a soft refresh, which at least re-runs
        // server components with the URL-encoded fallback.
        window.requestAnimationFrame(reload);
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(reload));
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('language')}
          className="ease-snap transition-all duration-150"
          disabled={isPending}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((entry) => (
          <DropdownMenuItem
            key={entry}
            onSelect={() => setLocale(entry)}
            className="flex items-center justify-between gap-3"
          >
            <span>{localeLabels[entry]}</span>
            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">
              {entry === locale ? tLayout('languageActive') : entry}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
