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
      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile primary"
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden"
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'fill-current')} />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button (FAB) for Create Issue */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg md:hidden"
        asChild
      >
        <Link href="/issues/new">
          <Plus className="h-6 w-6" />
        </Link>
      </Button>
    </>
  );
}

