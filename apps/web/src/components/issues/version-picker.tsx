'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import {
  useCreateProjectVersion,
  useProjectVersions,
  type ProjectVersion,
  type ProjectVersionWithCounts,
} from '@/lib/hooks/use-issue-versions';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
  getCreateErrorStatus,
  PickerCreateItem,
  PickerInlineError,
  PickerLiveRegion,
} from '@/components/issues/picker-create-item';
import { cn } from '@/lib/utils';

interface VersionPickerProps {
  projectId: string;
  /** Currently linked versions (full rows from GET /api/issues/[id]/versions). */
  value: ProjectVersion[];
  /** Called with the replacement id set (PUT semantics). */
  onChange: (versionIds: string[]) => void;
  disabled?: boolean;
  /** Trigger placeholder when nothing is selected. */
  placeholder?: string;
}

const STATUS_DOT_CLASS: Record<ProjectVersion['status'], string> = {
  unreleased: 'bg-accent-blue',
  released: 'bg-accent-emerald',
  archived: 'bg-muted-foreground/40',
};

/** Unreleased first, then released, then archived (API pre-sorts within). */
const STATUS_RANK: Record<ProjectVersion['status'], number> = {
  unreleased: 0,
  released: 1,
  archived: 2,
};

/** POST /api/projects/[id]/versions caps `name` at 120 chars. */
const MAX_NAME_LENGTH = 120;

export function VersionPicker({
  projectId,
  value,
  onChange,
  disabled = false,
  placeholder,
}: VersionPickerProps) {
  const t = useTranslations('issueSidebar.versions');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const { data: projectVersions, isLoading } = useProjectVersions(projectId);
  const createVersion = useCreateProjectVersion();

  // POST requires canManageProject — hide the create row from regular members.
  const { permissions } = useProjectPermissions(projectId);
  const canCreate =
    permissions.isSuperAdmin ||
    permissions.isOrgOwner ||
    permissions.isOrgAdmin ||
    permissions.canAdministerProject;

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  // Own filtering (Command shouldFilter={false}) so the create row's
  // visibility and exact-match suppression share one source of truth.
  const options = useMemo(() => {
    const versions = projectVersions ?? [];
    return (
      versions
        // Hide archived versions unless they are already linked to the issue.
        .filter((version) => version.status !== 'archived' || selectedIds.has(version.id))
        .filter(
          (version) => !normalizedSearch || version.name.toLowerCase().includes(normalizedSearch)
        )
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    );
  }, [projectVersions, selectedIds, normalizedSearch]);

  // Checked against the FULL list (incl. hidden archived) — POST would 409.
  const hasExactMatch = useMemo(
    () =>
      (projectVersions ?? []).some((version) => version.name.toLowerCase() === normalizedSearch),
    [projectVersions, normalizedSearch]
  );
  const showCreate =
    canCreate &&
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= MAX_NAME_LENGTH &&
    !hasExactMatch;

  const handleToggle = (versionId: string) => {
    const next = selectedIds.has(versionId)
      ? value.filter((v) => v.id !== versionId).map((v) => v.id)
      : [...value.map((v) => v.id), versionId];
    onChange(next);
  };

  const selectExisting = (version: ProjectVersion) => {
    if (!selectedIds.has(version.id)) {
      onChange([...value.map((v) => v.id), version.id]);
    }
  };

  const handleCreate = async () => {
    if (!showCreate || createVersion.isPending) return;
    const name = trimmedSearch;
    setCreateError(null);
    try {
      const created = await createVersion.mutateAsync({ projectId, name });
      selectExisting(created);
      setSearch('');
      setAnnouncement(t('created', { name: created.name }));
    } catch (error) {
      const status = getCreateErrorStatus(error);
      if (status === 409) {
        // Duplicate on the server (stale cache) — refetch and select it.
        await queryClient.invalidateQueries({ queryKey: ['project-versions', projectId] });
        const fresh =
          queryClient.getQueryData<ProjectVersionWithCounts[]>(['project-versions', projectId]) ??
          projectVersions ??
          [];
        const existing = fresh.find((v) => v.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          selectExisting(existing);
          setSearch('');
          setAnnouncement(t('duplicate', { name }));
          return;
        }
        setCreateError(t('duplicate', { name }));
      } else if (status === 403) {
        setCreateError(t('noPermission'));
      } else {
        setCreateError(t('createFailed'));
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
            {value.length > 0 ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block h-2 w-2 shrink-0 rounded-full',
                    STATUS_DOT_CLASS[value[0]!.status]
                  )}
                />
                <span className="truncate">{value.map((v) => v.name).join(', ')}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder ?? t('none')}</span>
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
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((version) => (
                    <CommandItem
                      key={version.id}
                      value={version.name}
                      onSelect={() => handleToggle(version.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedIds.has(version.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mr-2 inline-block h-2 w-2 shrink-0 rounded-full',
                          STATUS_DOT_CLASS[version.status]
                        )}
                      />
                      <span className="truncate">{version.name}</span>
                      <span className="text-muted-foreground ml-auto pl-2 text-[10px] uppercase tracking-wide">
                        {t(version.status)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showCreate && (
                <CommandGroup>
                  <PickerCreateItem
                    name={trimmedSearch}
                    label={t('create', { name: trimmedSearch })}
                    creating={createVersion.isPending}
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
