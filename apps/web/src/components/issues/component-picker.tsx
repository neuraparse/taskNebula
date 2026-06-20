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
  useCreateProjectComponent,
  useProjectComponents,
  type ProjectComponent,
  type ProjectComponentWithCount,
} from '@/lib/hooks/use-issue-components';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
  getCreateErrorStatus,
  PickerCreateItem,
  PickerInlineError,
  PickerLiveRegion,
} from '@/components/issues/picker-create-item';
import { cn } from '@/lib/utils';

interface ComponentPickerProps {
  projectId: string;
  /** Currently linked components (rows from GET /api/issues/[id]/components). */
  value: ProjectComponent[];
  /** Called with the replacement id set (PUT semantics). */
  onChange: (componentIds: string[]) => void;
  disabled?: boolean;
}

/** POST /api/projects/[id]/components caps `name` at 120 chars. */
const MAX_NAME_LENGTH = 120;

export function ComponentPicker({
  projectId,
  value,
  onChange,
  disabled = false,
}: ComponentPickerProps) {
  const t = useTranslations('issueSidebar.components');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const { data: projectComponents, isLoading } = useProjectComponents(projectId);
  const createComponent = useCreateProjectComponent();

  // POST requires canManageProject — hide the create row from regular members.
  const { permissions } = useProjectPermissions(projectId);
  const canCreate =
    permissions.isSuperAdmin ||
    permissions.isOrgOwner ||
    permissions.isOrgAdmin ||
    permissions.canAdministerProject;

  const selectedIds = useMemo(() => new Set(value.map((c) => c.id)), [value]);

  const trimmedSearch = search.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();

  // Own filtering (Command shouldFilter={false}) so the create row's
  // visibility and exact-match suppression share one source of truth.
  const options = useMemo(
    () =>
      (projectComponents ?? [])
        // Hide archived components unless they are already linked to the issue.
        .filter((component) => !component.archived || selectedIds.has(component.id))
        .filter(
          (component) =>
            !normalizedSearch || component.name.toLowerCase().includes(normalizedSearch)
        ),
    [projectComponents, selectedIds, normalizedSearch]
  );

  // Checked against the FULL list (incl. hidden archived) — POST would 409.
  const hasExactMatch = useMemo(
    () =>
      (projectComponents ?? []).some(
        (component) => component.name.toLowerCase() === normalizedSearch
      ),
    [projectComponents, normalizedSearch]
  );
  const showCreate =
    canCreate &&
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= MAX_NAME_LENGTH &&
    !hasExactMatch;

  const handleToggle = (componentId: string) => {
    const next = selectedIds.has(componentId)
      ? value.filter((c) => c.id !== componentId).map((c) => c.id)
      : [...value.map((c) => c.id), componentId];
    onChange(next);
  };

  const selectExisting = (component: ProjectComponent) => {
    if (!selectedIds.has(component.id)) {
      onChange([...value.map((c) => c.id), component.id]);
    }
  };

  const handleCreate = async () => {
    if (!showCreate || createComponent.isPending) return;
    const name = trimmedSearch;
    setCreateError(null);
    try {
      const created = await createComponent.mutateAsync({ projectId, name });
      selectExisting(created);
      setSearch('');
      setAnnouncement(t('created', { name: created.name }));
    } catch (error) {
      const status = getCreateErrorStatus(error);
      if (status === 409) {
        // Duplicate on the server (stale cache) — refetch and select it.
        await queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
        const fresh =
          queryClient.getQueryData<ProjectComponentWithCount[]>([
            'project-components',
            projectId,
          ]) ??
          projectComponents ??
          [];
        const existing = fresh.find((c) => c.name.toLowerCase() === name.toLowerCase());
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
              <span className="min-w-0 flex-1 truncate">{value.map((c) => c.name).join(', ')}</span>
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
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((component) => (
                    <CommandItem
                      key={component.id}
                      value={component.name}
                      onSelect={() => handleToggle(component.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedIds.has(component.id) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{component.name}</span>
                        {component.description && (
                          <span className="text-muted-foreground truncate text-xs">
                            {component.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showCreate && (
                <CommandGroup>
                  <PickerCreateItem
                    name={trimmedSearch}
                    label={t('create', { name: trimmedSearch })}
                    creating={createComponent.isPending}
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
