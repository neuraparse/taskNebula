'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('projectsPages');

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
          aria-label={t('ts_switch_aria')}
          className="h-8 w-full justify-between gap-2 px-2 transition-colors duration-200"
          disabled={!currentOrganizationId || isLoading}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Layers3 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-sm">
              {isLoading ? t('loading') : activeTeamspace?.name || t('ts_all')}
            </span>
          </span>
          <ChevronsUpDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="data-[state=open]:animate-scale-in w-[220px] shadow-sm"
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
          <Layers3 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t('ts_all')}</span>
          {!currentTeamId && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
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
              <span className="bg-accent-violet/10 text-accent-violet flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold">
                {teamspace.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 truncate text-sm">{teamspace.name}</span>
              {isActive ? (
                <Check className="text-primary h-3.5 w-3.5 shrink-0" />
              ) : teamspace.memberCount != null ? (
                <span className="chip text-[10px]">{teamspace.memberCount}</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-muted-foreground min-h-[36px] gap-2 px-2 text-sm transition-colors duration-200"
          onSelect={() => {
            setOpen(false);
            router.push('/settings/organization?tab=teamspaces');
          }}
        >
          <Settings2 className="h-3.5 w-3.5 shrink-0" />
          {t('ts_manage')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
