'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
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
import { useCreateLabel, useLabels, type OrgLabel } from '@/lib/hooks/use-labels';
import {
  getCreateErrorStatus,
  PickerCreateItem,
  PickerInlineError,
  PickerLiveRegion,
} from '@/components/issues/picker-create-item';
import { cn } from '@/lib/utils';

interface LabelPickerProps {
  value: string[];
  onChange: (labels: string[]) => void;
  disabled?: boolean;
  /**
   * Enables autocomplete against the org's label catalog (GET /api/labels).
   * Without it the picker falls back to a static suggestion list — the
   * emitted contract is unchanged either way: a plain `labels: string[]`
   * (the server resolves names → label rows and syncs the join table).
   */
  organizationId?: string | null;
  /** Narrows suggestions to this project's labels + org-wide ones. */
  projectId?: string | null;
}

/** Fallback suggestions when no org context is provided (legacy callers). */
const predefinedLabels = [
  'bug',
  'feature',
  'enhancement',
  'documentation',
  'design',
  'backend',
  'frontend',
  'database',
  'security',
  'performance',
  'testing',
  'urgent',
];

const FALLBACK_DOT_COLOR = 'hsl(var(--muted-foreground) / 0.45)';

export function LabelPicker({
  value,
  onChange,
  disabled = false,
  organizationId,
  projectId,
}: LabelPickerProps) {
  const t = useTranslations('issueSidebar.labels');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const deferredSearch = useDeferredValue(search);
  const createLabel = useCreateLabel();

  const orgId = organizationId ?? null;
  const labelScope = projectId ? { projectId } : {};
  // Unfiltered catalog: keeps color dots on selected chips while typing.
  const { data: allLabels } = useLabels(orgId, labelScope);
  // Server-side prefix autocomplete (?q=) drives the dropdown options.
  const { data: searchedLabels, isLoading } = useLabels(orgId, {
    ...labelScope,
    q: deferredSearch,
  });

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const label of allLabels ?? []) {
      map.set(label.name, label.color);
    }
    return map;
  }, [allLabels]);

  const trimmedSearch = search.trim();

  const options: Array<Pick<OrgLabel, 'name' | 'color'>> = useMemo(() => {
    if (orgId) {
      return (searchedLabels ?? []).map(({ name, color }) => ({ name, color }));
    }
    const prefix = trimmedSearch.toLowerCase();
    return predefinedLabels
      .filter((name) => !prefix || name.toLowerCase().startsWith(prefix))
      .map((name) => ({ name, color: FALLBACK_DOT_COLOR }));
  }, [orgId, searchedLabels, trimmedSearch]);

  const hasExactMatch =
    options.some((option) => option.name.toLowerCase() === trimmedSearch.toLowerCase()) ||
    value.some((name) => name.toLowerCase() === trimmedSearch.toLowerCase());
  const showCreate = trimmedSearch.length > 0 && trimmedSearch.length <= 100 && !hasExactMatch;

  const handleToggleLabel = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter((l) => l !== name));
    } else {
      onChange([...value, name]);
    }
  };

  const handleCreateLabel = async () => {
    if (!showCreate || createLabel.isPending) return;
    const name = trimmedSearch;
    setCreateError(null);

    if (orgId) {
      // Persist first so the label is born with a DS accent color (the
      // issue-PATCH write-through would otherwise create it default-gray).
      try {
        await createLabel.mutateAsync({ organizationId: orgId, name });
      } catch (error) {
        const status = getCreateErrorStatus(error);
        if (status === 403) {
          setCreateError(t('noPermission'));
          return;
        }
        if (status !== 409) {
          setCreateError(t('createFailed'));
          return;
        }
        // 409: the label already exists org-wide — selecting the name links it.
      }
    }

    onChange([...value, name]);
    setSearch('');
    setAnnouncement(t('created', { name }));
  };

  const handleRemoveLabel = (name: string) => {
    onChange(value.filter((l) => l !== name));
  };

  return (
    <div className="space-y-2">
      {/* Selected labels */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((label) => (
            <span key={label} className="chip inline-flex items-center gap-1 rounded-sm">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorByName.get(label) ?? FALLBACK_DOT_COLOR }}
              />
              {label}
              {!disabled && (
                <button
                  onClick={() => handleRemoveLabel(label)}
                  className="hover:text-destructive ease-snap ml-0.5 transition-colors duration-150"
                  aria-label={t('remove', { name: label })}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add label button */}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setCreateError(null);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-accent hover:text-foreground ease-snap h-8 justify-start rounded-md px-2 text-sm transition-colors duration-150"
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('add')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] max-w-[calc(100vw-2rem)] p-0">
          {/* Server-side ?q= filtering — disable cmdk's client filter. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t('searchOrCreate')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {!showCreate && (
                <CommandEmpty>{isLoading ? t('loading') : t('noResults')}</CommandEmpty>
              )}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.name}
                      value={option.name}
                      onSelect={() => handleToggleLabel(option.name)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value.includes(option.name) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                      <span className="truncate">{option.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showCreate && (
                <CommandGroup>
                  <PickerCreateItem
                    name={trimmedSearch}
                    label={t('create', { name: trimmedSearch })}
                    creating={createLabel.isPending}
                    onCreate={handleCreateLabel}
                  />
                </CommandGroup>
              )}
            </CommandList>
            <PickerInlineError message={createError} />
          </Command>
        </PopoverContent>
      </Popover>
      <PickerLiveRegion message={announcement} />
    </div>
  );
}
