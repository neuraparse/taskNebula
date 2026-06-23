'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { useOrganization } from '@/lib/hooks/use-organization';
import { useOrganizationPermissions, type Permission } from '@/lib/hooks/use-permissions';
import { stripLocalePrefix } from '@/components/layout/nav-paths';
import { UserProfileDropdown } from '@/components/user/user-profile-dropdown';

interface RailItem {
  name: string;
  href: string;
  icon: LucideIcon;
  showBadge?: boolean;
  requiredAnyPermissions?: Permission[];
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
  { key: 'team', href: '/team', icon: Users, requiredAnyPermissions: ['member:view', 'team:view'] },
  { key: 'settings', href: '/settings', icon: Settings },
];

export function AppRail({
  hasWorkspaceAccess = true,
  isSuperAdmin = false,
}: {
  hasWorkspaceAccess?: boolean;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname);
  const tNav = useTranslations('nav');
  const tLayout = useTranslations('layoutNav');
  const { currentOrganizationId } = useOrganization();
  const { hasAny: hasAnyOrgPermission, isLoading: isLoadingOrgPermissions } =
    useOrganizationPermissions(currentOrganizationId ?? undefined);
  // Lightweight unread count — keys on { unread: true } so the response is
  // small (just unread items, first page). Refetches every minute via the
  // hook's `refetchInterval`.
  const { data: inboxUnread } = useInbox({
    unread: true,
    limit: 50,
    enabled: hasWorkspaceAccess,
  });
  const unreadInboxCount = inboxUnread?.items?.length ?? 0;
  const visibleRailItems = railItems.filter((item) => {
    if (!hasWorkspaceAccess) {
      return item.key === 'home' || item.key === 'settings';
    }
    if (!item.requiredAnyPermissions) {
      return true;
    }
    return !isLoadingOrgPermissions && hasAnyOrgPermission(item.requiredAnyPermissions);
  });

  return (
    <TooltipProvider delayDuration={150}>
      <nav
        aria-label={tLayout('workspaceRail')}
        className="bg-surface-dark border-border-strong flex h-screen w-14 shrink-0 flex-col items-center border-r py-2 text-white"
      >
        <ul className="flex flex-1 flex-col items-center gap-1">
          {visibleRailItems.map((item) => {
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
                        'ease-snap group relative mx-auto flex h-[50px] w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white',
                        isActive &&
                          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-none'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {showInboxBadge && (
                        <span
                          aria-hidden="true"
                          data-testid="inbox-unread-badge"
                          className="bg-primary text-primary-foreground absolute right-1 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-semibold ring-1 ring-white/20"
                        >
                          {unreadInboxCount > 9 ? '9+' : unreadInboxCount}
                        </span>
                      )}
                      <span className="group-data-[active=true]:text-primary-foreground/90 line-clamp-2 h-5 w-full break-normal text-center text-[9px] leading-[10px] text-white/60 group-hover:text-white">
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
                    'ease-snap group mx-auto flex h-[50px] w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white',
                    normalizedPathname.startsWith('/admin') &&
                      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-none'
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="group-data-[active=true]:text-primary-foreground/90 line-clamp-2 h-5 w-full break-normal text-center text-[9px] leading-[10px] text-white/60 group-hover:text-white">
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
            triggerClassName="group mx-auto h-9 w-9 rounded-full border-0 bg-transparent p-0 text-white ring-0 hover:bg-transparent hover:text-white focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-0"
            avatarClassName="h-9 w-9 rounded-full ring-1 ring-white/20 transition-colors duration-150 group-hover:ring-white/45"
            fallbackClassName="rounded-full bg-white/10 text-[11px] font-semibold text-white/90 ring-0 group-hover:bg-white/15 group-hover:text-white"
          />
        </div>
      </nav>
    </TooltipProvider>
  );
}

export default AppRail;
