'use client';

import { LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
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

export function UserProfileDropdown() {
  const { user, isLoading } = useUser();

  if (isLoading || !user) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled aria-label="Account menu">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-muted text-xs text-muted-foreground">--</AvatarFallback>
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
          className="relative h-8 w-8 rounded-full p-0 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Account menu for ${user.name ?? user.email}`}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-60 rounded-lg shadow-sm data-[state=open]:animate-pop-in"
        align="end"
        sideOffset={8}
        forceMount
      >
        {/* Avatar header */}
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {user.name && (
              <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
            )}
            <p className="truncate text-xs leading-tight text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-2 px-3 transition-all duration-150 ease-snap" asChild>
          <Link href="/settings?tab=organization">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 px-3 transition-all duration-150 ease-snap" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 px-3 text-destructive transition-all duration-150 ease-snap focus:bg-destructive/10 focus:text-destructive"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
