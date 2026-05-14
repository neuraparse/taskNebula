'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  BookOpenText,
  FolderKanban,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  User as UserIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInbox } from '@/lib/hooks/use-inbox';

interface RailItem {
  name: string;
  href: string;
  icon: LucideIcon;
  showBadge?: boolean;
}

const railItems: RailItem[] = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: Inbox, showBadge: true },
  { name: 'Issues', href: '/my-issues', icon: Layers },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Docs', href: '/docs', icon: BookOpenText },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppRail() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === 'super_admin';
  // Lightweight unread count — keys on { unread: true } so the response is
  // small (just unread items, first page). Refetches every minute via the
  // hook's `refetchInterval`.
  const { data: inboxUnread } = useInbox({ unread: true, limit: 50 });
  const unreadInboxCount = inboxUnread?.items?.length ?? 0;

  const initials =
    session?.user?.name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U';

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label="Workspace rail"
        className="flex h-screen w-14 shrink-0 flex-col items-center border-r border-border bg-background py-2"
      >
        <ul className="flex flex-1 flex-col items-center gap-1">
          {railItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname?.startsWith(item.href + '/') ||
              (item.href === '/dashboard' &&
                (pathname === '/' ||
                  pathname?.startsWith('/drafts') ||
                  pathname?.startsWith('/templates'))) ||
              (item.href === '/my-issues' && pathname?.startsWith('/issues/'));
            const Icon = item.icon;
            const showInboxBadge = item.showBadge && unreadInboxCount > 0;

            return (
              <li key={item.name} className="w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      data-active={isActive ? 'true' : undefined}
                      aria-label={
                        showInboxBadge
                          ? `${item.name}, ${unreadInboxCount} unread`
                          : item.name
                      }
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'relative mx-auto flex w-12 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-muted-foreground transition-all duration-150 ease-snap hover:bg-accent/60 hover:text-foreground',
                        isActive && 'bg-accent text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {showInboxBadge && (
                        <span
                          aria-hidden="true"
                          data-testid="inbox-unread-badge"
                          className="absolute right-1 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground ring-1 ring-background"
                        >
                          {unreadInboxCount > 9 ? '9+' : unreadInboxCount}
                        </span>
                      )}
                      <span className="text-[10px] leading-tight text-muted-foreground">
                        {item.name}
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                    {showInboxBadge ? ` · ${unreadInboxCount} unread` : ''}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>

        <div className="mt-1 flex flex-col items-center gap-1 pb-1">
          {isSuperAdmin ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin"
                  aria-label="Admin"
                  className={cn(
                    'mx-auto flex w-12 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-muted-foreground transition-all duration-150 ease-snap hover:bg-accent/60 hover:text-foreground',
                    pathname?.startsWith('/admin') && 'bg-accent text-foreground'
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] leading-tight text-muted-foreground">Admin</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Admin</TooltipContent>
            </Tooltip>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-border transition-all duration-150 hover:ring-foreground/40"
              >
                <Avatar size="lg">
                  {session?.user?.image ? (
                    <AvatarImage src={session.user.image} alt={session.user.name ?? 'User'} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-[11px] font-medium text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="truncate text-sm font-medium">
                    {session?.user?.name ?? 'User'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session?.user?.email ?? 'Workspace'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span>Account settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </TooltipProvider>
  );
}

export default AppRail;
