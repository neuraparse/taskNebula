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
}

export function ResponsiveLayout({
  children,
  title,
  showSearch,
  onSearchClick,
  showMobileNav = true,
}: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MobileHeader
        title={title}
        showSearch={showSearch}
        onSearchClick={onSearchClick}
      />
      <main className="flex-1 pb-16">{children}</main>
      {showMobileNav && <MobileNav />}
    </div>
  );
}

