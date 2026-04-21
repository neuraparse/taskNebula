'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Kanban, Search, Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Board',
    href: '/board',
    icon: Kanban,
  },
  {
    name: 'Search',
    href: '/search',
    icon: Search,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Bottom tab bar */}
      <nav
        aria-label="Mobile primary"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <div className="flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md px-3 py-2 text-[10px] transition-colors duration-200',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-md md:hidden"
        asChild
      >
        <Link href="/issues/new" aria-label="Create new issue">
          <Plus className="h-5 w-5" />
        </Link>
      </Button>
    </>
  );
}
