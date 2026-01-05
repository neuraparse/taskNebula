'use client';

import { Menu, Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { OrganizationSwitcher } from '@/components/organization/organization-switcher';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface MobileHeaderProps {
  title?: string;
  showSearch?: boolean;
  onSearchClick?: () => void;
}

export function MobileHeader({
  title = 'TaskNebula',
  showSearch = false,
  onSearchClick,
}: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left: Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <div className="space-y-4 py-4">
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-lg font-semibold">Menu</h2>
                <div className="space-y-1">
                  <OrganizationSwitcher />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Center: Title */}
        <h1 className="text-lg font-semibold">{title}</h1>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <Button variant="ghost" size="icon" onClick={onSearchClick}>
              <Search className="h-5 w-5" />
            </Button>
          )}
          <NotificationBell />
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}

