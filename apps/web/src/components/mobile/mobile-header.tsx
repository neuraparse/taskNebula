'use client';

import { Menu, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('mobileNav');
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-3">
        {/* Left: Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ease-snap h-9 w-9 transition-all duration-150"
              aria-label={t('openMenu')}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="animate-slide-in-from-left border-border bg-surface w-72 rounded-r-lg border-r"
          >
            <div className="space-y-4 py-4">
              <div className="px-2">
                <OrganizationSwitcher />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Center: Title */}
        <span className="truncate text-sm font-semibold tracking-tight">{title}</span>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {showSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="ease-snap h-9 w-9 transition-all duration-150"
              onClick={onSearchClick}
              aria-label={t('search')}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          <NotificationBell />
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
