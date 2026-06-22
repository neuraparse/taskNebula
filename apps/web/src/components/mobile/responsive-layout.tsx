'use client';

import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-media-query';
import { MobileNav } from './mobile-nav';
import { MobileHeader } from './mobile-header';

interface ResponsiveLayoutProps {
  children: ReactNode;
  title?: string;
  showSearch?: boolean;
  onSearchClick?: () => void;
  showMobileNav?: boolean;
  hasWorkspaceAccess?: boolean;
}

export function ResponsiveLayout({
  children,
  title,
  showSearch,
  onSearchClick,
  showMobileNav = true,
  hasWorkspaceAccess = true,
}: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col overflow-x-hidden">
      <MobileHeader title={title} showSearch={showSearch} onSearchClick={onSearchClick} />
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      {showMobileNav && <MobileNav hasWorkspaceAccess={hasWorkspaceAccess} />}
    </div>
  );
}
