'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderKanban, Home, Inbox, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripLocalePrefix } from '@/components/layout/nav-paths';

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    match: '/dashboard',
    icon: Home,
  },
  {
    name: 'My Issues',
    href: '/my-issues',
    match: '/my-issues',
    icon: Inbox,
  },
  {
    name: 'Projects',
    href: '/projects',
    match: '/projects',
    icon: FolderKanban,
  },
  {
    name: 'Settings',
    href: '/settings',
    match: '/settings',
    icon: Settings,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname);

  return (
    <nav
      aria-label="Mobile primary"
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
              <span>{item.name}</span>
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
