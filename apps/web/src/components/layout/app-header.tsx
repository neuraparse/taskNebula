'use client';

import { Search, HelpCircle, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useCommandPalette } from '@/lib/command/use-command-palette';

export function AppHeader() {
  const palette = useCommandPalette();
  const openPalette = () => palette.open();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      {/* Workspace + search trigger */}
      <div className="flex flex-1 items-center gap-4">
        <OrganizationSwitcher />
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          className="group relative flex h-9 w-full max-w-md items-center rounded-md border border-border bg-surface pl-9 pr-2 text-left text-sm text-muted-foreground transition-all duration-150 ease-snap hover:border-primary/30 hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <span className="truncate">Search issues, projects, docs…</span>
          <kbd className="chip pointer-events-none ml-auto inline-flex shrink-0 select-none items-center gap-1 font-mono text-[10px]">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help"
          className="transition-all duration-150 ease-snap"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <UserProfileDropdown />
      </div>
    </header>
  );
}
