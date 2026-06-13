'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, Home, Inbox, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { stripLocalePrefix } from '@/components/layout/nav-paths';

const navItems = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    match: '/dashboard',
    icon: Home,
  },
  {
    labelKey: 'myIssues',
    href: '/my-issues',
    match: '/my-issues',
    icon: Inbox,
  },
  {
    labelKey: 'projects',
    href: '/projects',
    match: '/projects',
    icon: FolderKanban,
  },
  {
    labelKey: 'settings',
    href: '/settings',
    match: '/settings',
    icon: Settings,
  },
] as const;

export function MobileNav() {
  const t = useTranslations('mobileNav');
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname);

  return (
    <nav
      aria-label={t('primaryNavAria')}
      className="border-border bg-background/90 fixed bottom-0 left-0 right-0 z-50 h-14 border-t backdrop-blur md:hidden"
    >
      <div className="flex h-full items-center justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            normalizedPathname === item.match || normalizedPathname.startsWith(`${item.match}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={isActive ? 'true' : undefined}
              className={cn(
                'ease-snap relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10px] font-medium transition-all duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="bg-primary absolute bottom-1 h-1 w-1 rounded-full"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
