'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Layers3, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { cn } from '@/lib/utils';

export function TeamspaceSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currentOrganizationId, currentTeamId, setCurrentTeam } = useOrganization();
  const { data: teamspaces = [], isLoading } = useTeamspaces(currentOrganizationId);

  useEffect(() => {
    if (!currentTeamId) return;
    const existsInOrganization = teamspaces.some((ts) => ts.id === currentTeamId);
    if (!existsInOrganization) {
      setCurrentTeam(null);
    }
  }, [currentTeamId, setCurrentTeam, teamspaces]);

  const activeTeamspace = useMemo(
    () => teamspaces.find((ts) => ts.id === currentTeamId) ?? null,
    [currentTeamId, teamspaces]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Switch teamspace"
          className="h-8 w-full justify-between gap-2 px-2 transition-colors duration-200"
          disabled={!currentOrganizationId || isLoading}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Layers3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">
              {isLoading ? 'Loading...' : activeTeamspace?.name || 'All Teamspaces'}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[220px] shadow-sm data-[state=open]:animate-scale-in"
        align="start"
        sideOffset={4}
      >
        <DropdownMenuItem
          className={cn(
            'min-h-[36px] gap-2 px-2 text-sm transition-colors duration-200',
            !currentTeamId && 'bg-accent'
          )}
          onSelect={() => {
            setCurrentTeam(null);
            setOpen(false);
          }}
        >
          <Layers3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1">All Teamspaces</span>
          {!currentTeamId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </DropdownMenuItem>

        {teamspaces.length > 0 && <DropdownMenuSeparator />}

        {teamspaces.map((teamspace) => {
          const isActive = currentTeamId === teamspace.id;
          return (
            <DropdownMenuItem
              key={teamspace.id}
              className={cn(
                'min-h-[36px] gap-2 px-2 transition-colors duration-200',
                isActive && 'bg-accent'
              )}
              onSelect={() => {
                setCurrentTeam(teamspace.id);
                setOpen(false);
              }}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent-violet/10 text-[9px] font-bold text-accent-violet">
                {teamspace.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 truncate text-sm">{teamspace.name}</span>
              {isActive ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : teamspace.memberCount != null ? (
                <span className="chip text-[10px]">{teamspace.memberCount}</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-[36px] gap-2 px-2 text-sm text-muted-foreground transition-colors duration-200"
          onSelect={() => {
            setOpen(false);
            router.push('/settings/organization?tab=teamspaces');
          }}
        >
          <Settings2 className="h-3.5 w-3.5 shrink-0" />
          Manage teamspaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
