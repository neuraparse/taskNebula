'use client';

import { Search, HelpCircle, Command } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useCommandPalette } from '@/lib/command/use-command-palette';

export function AppHeader({ hasWorkspaceAccess = true }: { hasWorkspaceAccess?: boolean }) {
  const tNav = useTranslations('nav');
  const tActions = useTranslations('actions');
  const { open: openPalette } = useCommandPalette();

  return (
    <header className="bg-surface-dark border-border-strong sticky top-0 z-30 flex h-12 items-center justify-between border-b px-4 text-white shadow-none">
      {/* Workspace + search trigger */}
      <div className="flex flex-1 items-center gap-3">
        {hasWorkspaceAccess ? (
          <>
            <OrganizationSwitcher />
            <button
              type="button"
              onClick={openPalette}
              aria-label={tActions('open_command_palette')}
              className="bg-surface-elevated border-subtle ease-snap focus-visible:ring-ring group relative flex h-8 w-full max-w-xl items-center rounded-md border pe-2 ps-9 text-start text-[13px] text-white/65 transition-all duration-150 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2"
            >
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
              <span className="truncate">{tNav('search_placeholder')}</span>
              <kbd className="pointer-events-none ms-auto inline-flex shrink-0 select-none items-center gap-1 rounded-sm border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/75">
                <Command className="h-3 w-3" />
                {'K'}
              </kbd>
            </button>
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-0.5">
        {hasWorkspaceAccess ? <NotificationBell /> : null}
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          aria-label={tActions('help')}
          className="ease-snap h-8 w-8 text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
