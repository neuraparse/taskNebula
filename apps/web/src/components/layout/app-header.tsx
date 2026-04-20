'use client';

import { Search, HelpCircle, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { NotificationBell } from '@/components/notifications/notification-bell';

export function AppHeader() {
  const openPalette = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      {/* Organization Switcher & Search */}
      <div className="flex flex-1 items-center gap-4">
        <OrganizationSwitcher />
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open command palette"
          className="relative flex h-10 w-96 items-center rounded-md border border-input bg-background pl-9 pr-20 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <span className="truncate">Search issues, projects, docs...</span>
          <kbd className="pointer-events-none absolute right-3 top-1/2 inline-flex h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Button variant="ghost" size="icon" aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <UserProfileDropdown />
      </div>
    </header>
  );
}
