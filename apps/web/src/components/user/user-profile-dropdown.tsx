'use client';

import { useState } from 'react';
import { Loader2, LogOut, Settings } from 'lucide-react';
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
  fallbackClassName?: string;
}

export function UserProfileDropdown({
  side = 'bottom',
  align = 'end',
  sideOffset = 8,
  triggerClassName,
  avatarClassName,
  fallbackClassName,
}: UserProfileDropdownProps = {}) {
  const { user, isLoading } = useUser();
  const t = useTranslations('userSecurity');
  const tNav = useTranslations('nav');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const triggerClasses = cn(
    'relative h-9 w-9 rounded-[2px] border border-border bg-card p-0 shadow-none transition-colors duration-150 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe]',
    triggerClassName
  );
  const avatarClasses = cn('h-8 w-8 rounded-[2px]', avatarClassName);
  const fallbackClasses = cn(
    'bg-muted text-muted-foreground rounded-[2px] text-xs font-medium',
    fallbackClassName
  );

  if (isLoading || !user) {
    return (
      <Button variant="ghost" className={triggerClasses} disabled aria-label={t('accountMenu')}>
        <Avatar className={avatarClasses}>
          <AvatarFallback className={fallbackClasses}>--</AvatarFallback>
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
            <AvatarFallback className={fallbackClasses}>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="data-[state=open]:animate-pop-in border-border w-72 rounded-[2px] p-0 shadow-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
        forceMount
      >
        {/* Avatar header */}
        <div className="border-border flex items-center gap-3 border-b px-3 py-3">
          <Avatar className="h-9 w-9 shrink-0 rounded-[2px]">
            <AvatarImage src={user.image || undefined} alt={user.name || t('userAlt')} />
            <AvatarFallback className={fallbackClasses}>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {user.name && <p className="truncate text-sm font-medium leading-tight">{user.name}</p>}
            <p className="text-muted-foreground truncate text-xs leading-tight">{user.email}</p>
          </div>
        </div>

        <DropdownMenuItem
          className="focus:bg-accent h-11 rounded-none px-3 text-sm transition-colors duration-150"
          asChild
        >
          <Link href="/settings">
            <Settings className="text-muted-foreground h-4 w-4 shrink-0" />
            {tNav('account_settings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive h-11 rounded-none px-3 text-sm transition-colors duration-150"
          disabled={isSigningOut}
          onSelect={(event) => {
            event.preventDefault();
            if (isSigningOut) return;
            setIsSigningOut(true);
            void signOut({ callbackUrl: '/auth/signin' });
          }}
        >
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0" />
          )}
          {tNav('sign_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
