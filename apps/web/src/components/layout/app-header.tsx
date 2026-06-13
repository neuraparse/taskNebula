'use client';

import { Search, HelpCircle, Command } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useCommandPalette } from '@/lib/command/use-command-palette';

export function AppHeader() {
  const tNav = useTranslations('nav');
  const tActions = useTranslations('actions');
  const { open: openPalette } = useCommandPalette();

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-6 backdrop-blur">
      {/* Workspace + search trigger */}
      <div className="flex flex-1 items-center gap-4">
        <OrganizationSwitcher />
        <button
          type="button"
          onClick={openPalette}
          aria-label={tActions('open_command_palette')}
          className="border-border bg-surface text-muted-foreground ease-snap hover:border-primary/30 hover:bg-accent/60 hover:text-foreground focus-visible:ring-ring group relative flex h-9 w-full max-w-md items-center rounded-md border pe-2 ps-9 text-start text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
        >
          <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <span className="truncate">{tNav('search_placeholder')}</span>
          <kbd className="chip pointer-events-none ms-auto inline-flex shrink-0 select-none items-center gap-1 font-mono text-[10px]">
            <Command className="h-3 w-3" />
            {'K'}
          </kbd>
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          aria-label={tActions('help')}
          className="ease-snap transition-all duration-150"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <UserProfileDropdown />
      </div>
    </header>
  );
}
