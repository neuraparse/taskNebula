'use client';

import { Search, HelpCircle, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { NotificationBell } from '@/components/notifications/notification-bell';

export function AppHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      {/* Organization Switcher & Search */}
      <div className="flex flex-1 items-center gap-4">
        <OrganizationSwitcher />
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search issues, projects..."
            className="pl-9 pr-20"
            onFocus={(e) => {
              e.preventDefault();
              // Trigger command palette instead
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
              e.target.blur();
            }}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 inline-flex h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <UserProfileDropdown />
      </div>
    </header>
  );
}

