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
import {
  LOCALE_COOKIE,
  localeLabels,
  locales,
  type Locale,
} from '@/lib/i18n/config';

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
  const [isPending, startTransition] = useTransition();

  const setLocale = (next: Locale) => {
    if (next === locale) return;
    // 1 year, lax — same as next-intl's default cookie behavior.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      // Hard reload so the server re-renders <html lang> + dir and every
      // server component picks up the new catalog. Soft router.refresh()
      // would not update server-rendered <html> attributes reliably.
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('language')}
          className="transition-all duration-150 ease-snap"
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
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {entry === locale ? 'Active' : entry}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
