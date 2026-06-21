'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser } from '@/lib/hooks/use-user';
import { cn } from '@/lib/utils';

type DropdownSide = 'top' | 'right' | 'bottom' | 'left';
type DropdownAlign = 'start' | 'center' | 'end';

interface UserProfileDropdownProps {
  side?: DropdownSide;
  align?: DropdownAlign;
  sideOffset?: number;
  triggerClassName?: string;
  avatarClassName?: string;
}

export function UserProfileDropdown({
  side = 'bottom',
  align = 'end',
  sideOffset = 8,
  triggerClassName,
  avatarClassName,
}: UserProfileDropdownProps = {}) {
  const { user, isLoading } = useUser();
  const t = useTranslations('userSecurity');
  const tNav = useTranslations('nav');
  const triggerClasses = cn(
    'focus-visible:ring-ring relative h-8 w-8 rounded-full p-0 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    triggerClassName
  );
  const avatarClasses = cn('h-8 w-8', avatarClassName);

  if (isLoading || !user) {
    return (
      <Button variant="ghost" className={triggerClasses} disabled aria-label={t('accountMenu')}>
        <Avatar className={avatarClasses}>
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">--</AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0]?.toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={triggerClasses}
          aria-label={t('accountMenuFor', { name: user.name ?? user.email ?? '' })}
        >
          <Avatar className={avatarClasses}>
            <AvatarImage src={user.image || undefined} alt={user.name || t('userAlt')} />
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="data-[state=open]:animate-pop-in w-60 rounded-lg shadow-sm"
        align={align}
        side={side}
        sideOffset={sideOffset}
        forceMount
      >
        {/* Avatar header */}
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.image || undefined} alt={user.name || t('userAlt')} />
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {user.name && <p className="truncate text-sm font-medium leading-tight">{user.name}</p>}
            <p className="text-muted-foreground truncate text-xs leading-tight">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="ease-snap gap-2 px-3 transition-all duration-150" asChild>
          <Link href="/settings">
            <Settings className="text-muted-foreground h-4 w-4 shrink-0" />
            {tNav('account_settings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive ease-snap focus:bg-destructive/10 focus:text-destructive gap-2 px-3 transition-all duration-150"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {tNav('sign_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
