'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { useIssues } from '@/lib/hooks/use-issues';
import { useCreateEpic } from '@/lib/hooks/use-create-epic';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
  getCreateErrorStatus,
  PickerCreateItem,
  PickerInlineError,
  PickerLiveRegion,
} from '@/components/issues/picker-create-item';
import { cn } from '@/lib/utils';

interface EpicPickerProps {
  projectId: string;
  /** Epic issue id, or null when the issue belongs to no epic. */
  value: string | null;
  onChange: (epicId: string | null) => void;
  /** The issue being edited — an epic must never be its own epic. */
  excludeIssueId?: string;
  disabled?: boolean;
}

/** POST /api/issues caps `title` at 500 chars. */
const MAX_TITLE_LENGTH = 500;

export function EpicPicker({
  projectId,
  value,
  onChange,
  excludeIssueId,
  disabled = false,
}: EpicPickerProps) {
  const t = useTranslations('issueSidebar.epic');
  const tCreate = useTranslations('epicPicker');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const { data, isLoading } = useIssues({ projectId, type: 'epic' });
  const createEpic = useCreateEpic();

  // POST requires issue-create permission; organization-level overrides are
  // included in the project permissions payload.
  const { permissions } = useProjectPermissions(projectId);
  const canCreate =
    permissions.isSuperAdmin || permissions.isOrgOwner || permissions.canCreateIssues;

  const epics = useMemo(
    () => (data ?? []).filter((epic) => epic.id !== excludeIssueId),
    [data, excludeIssueId]
  );
  const selected = value ? epics.find((epic) => epic.id === value) : null;

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  // Own filtering (Command shouldFilter={false}) so the create row's
  // visibility and exact-match suppression share one source of truth.
  const options = useMemo(
    () =>
      epics.filter(
        (epic) =>
          !normalizedSearch ||
          epic.title.toLowerCase().includes(normalizedSearch) ||
          epic.key.toLowerCase().includes(normalizedSearch)
      ),
    [epics, normalizedSearch]
  );

  const hasExactMatch = useMemo(
    () => epics.some((epic) => epic.title.toLowerCase() === normalizedSearch),
    [epics, normalizedSearch]
  );
  const showCreate =
    canCreate &&
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= MAX_TITLE_LENGTH &&
    !hasExactMatch;

  const handleCreate = async () => {
    if (!showCreate || createEpic.isPending) return;
    const title = trimmedSearch;
    setCreateError(null);
    try {
      const created = await createEpic.mutateAsync({ projectId, title });
      onChange(created.id);
      setSearch('');
      setAnnouncement(tCreate('creating', { name: created.title }));
      setOpen(false);
    } catch (error) {
      const status = getCreateErrorStatus(error);
      if (status === 403) {
        setCreateError(tCreate('noPermission'));
      } else {
        setCreateError(tCreate('createFailed'));
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
                <Zap className="text-accent-violet h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{selected.title}</span>
              </span>
            ) : (
              <span className="text-muted-foreground min-w-0 flex-1 truncate">{t('none')}</span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          {/* Own filtering above keeps the create row in sync — disable cmdk's. */}
          <Command shouldFilter={false}>
            <CommandInput placeholder={t('search')} value={search} onValueChange={setSearch} />
            <CommandList>
              {!showCreate && <CommandEmpty>{t('empty')}</CommandEmpty>}
              <CommandGroup>
                {/* No-epic option */}
                <CommandItem
                  value="__no_epic__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  <X className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                  <span className="text-muted-foreground">{t('none')}</span>
                </CommandItem>

                {options.map((epic) => (
                  <CommandItem
                    key={epic.id}
                    value={`${epic.key} ${epic.title}`}
                    onSelect={() => {
                      onChange(epic.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === epic.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Zap className="text-accent-violet mr-2 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{epic.title}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-[10px]">
                      {epic.key}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreate && (
                <CommandGroup>
                  <PickerCreateItem
                    name={trimmedSearch}
                    label={tCreate('createEpic', { name: trimmedSearch })}
                    creating={createEpic.isPending}
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
