'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import { useProjectVersions, type ProjectVersion } from '@/lib/hooks/use-issue-versions';
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

export function VersionPicker({
  projectId,
  value,
  onChange,
  disabled = false,
  placeholder,
}: VersionPickerProps) {
  const t = useTranslations('issueSidebar.versions');
  const [open, setOpen] = useState(false);
  const { data: projectVersions, isLoading } = useProjectVersions(projectId);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const options = useMemo(() => {
    const versions = projectVersions ?? [];
    return (
      versions
        // Hide archived versions unless they are already linked to the issue.
        .filter((version) => version.status !== 'archived' || selectedIds.has(version.id))
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    );
  }, [projectVersions, selectedIds]);

  const handleToggle = (versionId: string) => {
    const next = selectedIds.has(versionId)
      ? value.filter((v) => v.id !== versionId).map((v) => v.id)
      : [...value.map((v) => v.id), versionId];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <Command>
          <CommandInput placeholder={t('search')} />
          <CommandList>
            <CommandEmpty>{t('empty')}</CommandEmpty>
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
