'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSprints, useInlineCreateSprint, type Sprint } from '@/lib/hooks/use-sprints';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
  getCreateErrorStatus,
  PickerCreateItem,
  PickerInlineError,
  PickerLiveRegion,
} from '@/components/issues/picker-create-item';
import { cn } from '@/lib/utils';

/** Active sprints first, then planned, then completed. Exported for tests. */
export function orderSprintsForPicker(sprints: ReadonlyArray<Sprint>): Sprint[] {
  const rank: Record<Sprint['status'], number> = { active: 0, planned: 1, completed: 2 };
  return [...sprints].sort((a, b) => rank[a.status] - rank[b.status]);
}

const STATUS_DOT: Record<Sprint['status'], string> = {
  active: 'bg-accent-emerald',
  planned: 'bg-accent-blue',
  completed: 'bg-muted-foreground/40',
};

/** The `sprints.name` column is varchar(255); keep the create row in step. */
const MAX_NAME_LENGTH = 255;

interface SprintPickerProps {
  projectId: string;
  /** Sprint id, or null for backlog (no sprint). */
  value: string | null;
  onChange: (sprintId: string | null) => void;
  disabled?: boolean;
}

export function SprintPicker({ projectId, value, onChange, disabled = false }: SprintPickerProps) {
  const t = useTranslations('issueSidebar.sprint');
  const tc = useTranslations('sprintPicker');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const { data, isLoading } = useSprints(projectId);
  const createSprint = useInlineCreateSprint();

  // POST /api/sprints requires sprint-manage rights — hide the create row from
  // regular members, mirroring the component picker's gate.
  const { permissions } = useProjectPermissions(projectId);
  const canCreate =
    permissions.isSuperAdmin || permissions.isOrgOwner || permissions.canManageSprints;

  const allSprints = orderSprintsForPicker(data ?? []);
  const selected = value ? allSprints.find((sprint) => sprint.id === value) : null;

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  // Own filtering (Command shouldFilter={false}) so the create row's
  // visibility and exact-match suppression share one source of truth.
  const sprints = useMemo(
    () =>
      allSprints.filter(
        (sprint) => !normalizedSearch || sprint.name.toLowerCase().includes(normalizedSearch)
      ),
    [allSprints, normalizedSearch]
  );

  const hasExactMatch = useMemo(
    () => allSprints.some((sprint) => sprint.name.toLowerCase() === normalizedSearch),
    [allSprints, normalizedSearch]
  );
  const showCreate =
    canCreate &&
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= MAX_NAME_LENGTH &&
    !hasExactMatch;

  const selectSprint = (sprint: Sprint) => {
    onChange(sprint.id);
    setSearch('');
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!showCreate || createSprint.isPending) return;
    const name = trimmedSearch;
    setCreateError(null);
    try {
      const created = await createSprint.mutateAsync({ projectId, name });
      onChange(created.id);
      setSearch('');
      setOpen(false);
      setAnnouncement(tc('creating', { name: created.name }));
    } catch (error) {
      const status = getCreateErrorStatus(error);
      if (status === 409) {
        // Duplicate on the server (stale cache) — refetch and select it.
        await queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
        const fresh = queryClient.getQueryData<Sprint[]>(['sprints', projectId]) ?? data ?? [];
        const existing = fresh.find((s) => s.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          selectSprint(existing);
          setAnnouncement(tc('exists', { name }));
          return;
        }
        setCreateError(tc('exists', { name }));
      } else if (status === 403) {
        setCreateError(tc('noPermission'));
      } else {
        setCreateError(tc('createFailed'));
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
      setCreateError(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="hover:bg-accent ease-snap h-8 w-full justify-between rounded-md px-2 text-sm transition-colors duration-150"
            disabled={disabled || isLoading}
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[selected.status])}
                  aria-hidden
                />
                <span className="truncate">{selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground flex min-w-0 flex-1 items-center gap-2">
                <Inbox className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t('backlog')}</span>
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] max-w-[calc(100vw-2rem)] p-0">
          {/* Own filtering above keeps the create row in sync — disable cmdk's. */}
          <Command shouldFilter={false}>
            <CommandInput placeholder={t('search')} value={search} onValueChange={setSearch} />
            <CommandList>
              {!showCreate && <CommandEmpty>{t('empty')}</CommandEmpty>}
              <CommandGroup>
                {/* Backlog (no sprint) option — hidden while filtering by name. */}
                {!trimmedSearch && (
                  <CommandItem
                    value="__backlog__"
                    onSelect={() => {
                      onChange(null);
                      setSearch('');
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                    <Inbox className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                    <span className="text-muted-foreground">{t('backlog')}</span>
                  </CommandItem>
                )}

                {sprints.map((sprint) => (
                  <CommandItem
                    key={sprint.id}
                    value={sprint.name}
                    onSelect={() => selectSprint(sprint)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === sprint.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span
                      className={cn(
                        'mr-2 h-2 w-2 shrink-0 rounded-full',
                        STATUS_DOT[sprint.status]
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
                    <span className="text-muted-foreground ml-2 text-[10px] uppercase tracking-wide">
                      {t(`status.${sprint.status}`)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreate && (
                <CommandGroup>
                  <PickerCreateItem
                    name={trimmedSearch}
                    label={tc('createSprint', { name: trimmedSearch })}
                    creating={createSprint.isPending}
                    onCreate={handleCreate}
                  />
                </CommandGroup>
              )}
            </CommandList>
            <PickerInlineError message={createError} />
          </Command>
        </PopoverContent>
      </Popover>
      <PickerLiveRegion message={announcement} />
    </>
  );
}
