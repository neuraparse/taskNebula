'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Layers3, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { cn } from '@/lib/utils';

export function TeamspaceSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currentOrganizationId, currentTeamId, setCurrentTeam } = useOrganization();
  const { data: teamspaces = [], isLoading } = useTeamspaces(currentOrganizationId);

  useEffect(() => {
    if (!currentTeamId) {
      return;
    }

    const existsInOrganization = teamspaces.some((teamspace) => teamspace.id === currentTeamId);
    if (!existsInOrganization) {
      setCurrentTeam(null);
    }
  }, [currentTeamId, setCurrentTeam, teamspaces]);

  const activeTeamspace = useMemo(
    () => teamspaces.find((teamspace) => teamspace.id === currentTeamId) ?? null,
    [currentTeamId, teamspaces]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between rounded-none border-border/60 bg-background px-2.5 text-sm"
          disabled={!currentOrganizationId || isLoading}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Layers3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {isLoading
                ? 'Loading teamspaces...'
                : activeTeamspace?.name || 'All Teamspaces'}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] rounded-none border-border/60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search teamspaces..." />
          <CommandList>
            <CommandEmpty>No teamspace found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All Teamspaces"
                onSelect={() => {
                  setCurrentTeam(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn('mr-2 h-4 w-4', currentTeamId ? 'opacity-0' : 'opacity-100')}
                />
                <div className="flex flex-col">
                  <span>All Teamspaces</span>
                  <span className="text-xs text-muted-foreground">
                    Show every project in this organization
                  </span>
                </div>
              </CommandItem>

              {teamspaces.map((teamspace) => (
                <CommandItem
                  key={teamspace.id}
                  value={teamspace.name}
                  onSelect={() => {
                    setCurrentTeam(teamspace.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      currentTeamId === teamspace.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{teamspace.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {teamspace.description || (teamspace.isMember ? 'Member' : 'Organization')}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Manage">
              <CommandItem
                value="Manage teamspaces"
                onSelect={() => {
                  setOpen(false);
                  router.push('/settings/organization?tab=teamspaces');
                }}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Manage Teamspaces</span>
                  <span className="text-xs text-muted-foreground">
                    Create, edit, and assign members
                  </span>
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
