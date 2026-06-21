'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  BookOpenText,
  FolderKanban,
  Inbox,
  Layers,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInbox } from '@/lib/hooks/use-inbox';
import { stripLocalePrefix } from '@/components/layout/nav-paths';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';

interface RailItem {
  name: string;
  href: string;
  icon: LucideIcon;
  showBadge?: boolean;
}

// Rail items declare a translation key (resolved against `nav`) instead of
// inline English so the rail respects the user's chosen locale. The
// `href` stays language-agnostic; next-intl handles the `/[locale]` prefix
// at render time via `useTranslations('nav')`.
type RailItemKey = 'home' | 'inbox' | 'my_issues' | 'projects' | 'docs' | 'team' | 'settings';

const railItems: (Omit<RailItem, 'name'> & { key: RailItemKey })[] = [
  { key: 'home', href: '/dashboard', icon: LayoutDashboard },
  { key: 'inbox', href: '/inbox', icon: Inbox, showBadge: true },
  { key: 'my_issues', href: '/my-issues', icon: Layers },
  { key: 'projects', href: '/projects', icon: FolderKanban },
  { key: 'docs', href: '/docs', icon: BookOpenText },
  { key: 'team', href: '/team', icon: Users },
  { key: 'settings', href: '/settings', icon: Settings },
];

export function AppRail() {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname);
  const { data: session } = useSession();
  const tNav = useTranslations('nav');
  const tLayout = useTranslations('layoutNav');
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === 'super_admin';
  // Lightweight unread count — keys on { unread: true } so the response is
  // small (just unread items, first page). Refetches every minute via the
  // hook's `refetchInterval`.
  const { data: inboxUnread } = useInbox({ unread: true, limit: 50 });
  const unreadInboxCount = inboxUnread?.items?.length ?? 0;

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label={tLayout('workspaceRail')}
        className="border-border bg-card flex h-screen w-14 shrink-0 flex-col items-center border-r py-2"
      >
        <ul className="flex flex-1 flex-col items-center gap-1">
          {railItems.map((item) => {
            const label = tNav(item.key);
            const isActive =
              normalizedPathname === item.href ||
              normalizedPathname.startsWith(item.href + '/') ||
              (item.href === '/dashboard' &&
                (normalizedPathname === '/' ||
                  normalizedPathname.startsWith('/drafts') ||
                  normalizedPathname.startsWith('/templates'))) ||
              (item.href === '/my-issues' && normalizedPathname.startsWith('/issues/'));
            const Icon = item.icon;
            const showInboxBadge = item.showBadge && unreadInboxCount > 0;
            const unreadLabel = tNav('inbox_unread', { count: unreadInboxCount });

            return (
              <li key={item.key} className="w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      data-active={isActive ? 'true' : undefined}
                      aria-label={showInboxBadge ? `${label} · ${unreadLabel}` : label}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'text-muted-foreground ease-snap hover:bg-accent/60 hover:text-foreground group relative mx-auto flex h-[50px] w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 transition-all duration-150',
                        isActive &&
                          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {showInboxBadge && (
                        <span
                          aria-hidden="true"
                          data-testid="inbox-unread-badge"
                          className="bg-primary text-primary-foreground ring-background absolute right-1 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-semibold ring-1"
                        >
                          {unreadInboxCount > 9 ? '9+' : unreadInboxCount}
                        </span>
                      )}
                      <span className="text-muted-foreground group-data-[active=true]:text-primary-foreground/90 line-clamp-2 h-5 w-full break-normal text-center text-[9px] leading-[10px]">
                        {label}
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {label}
                    {showInboxBadge ? ` · ${unreadLabel}` : ''}
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
                  data-active={normalizedPathname.startsWith('/admin') ? 'true' : undefined}
                  aria-label={tNav('admin')}
                  className={cn(
                    'text-muted-foreground ease-snap hover:bg-accent/60 hover:text-foreground group mx-auto flex h-[50px] w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 transition-all duration-150',
                    normalizedPathname.startsWith('/admin') &&
                      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm'
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground group-data-[active=true]:text-primary-foreground/90 line-clamp-2 h-5 w-full break-normal text-center text-[9px] leading-[10px]">
                    {tNav('admin')}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{tNav('admin')}</TooltipContent>
            </Tooltip>
          ) : null}

          <UserProfileDropdown
            side="right"
            align="end"
            triggerClassName="ring-border hover:ring-foreground/40 mx-auto h-9 w-9 rounded-full ring-1 hover:bg-transparent"
          />
        </div>
      </nav>
    </TooltipProvider>
  );
}

export default AppRail;
