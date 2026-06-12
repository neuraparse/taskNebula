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
import { useProjectComponents, type ProjectComponent } from '@/lib/hooks/use-issue-components';
import { cn } from '@/lib/utils';

interface ComponentPickerProps {
  projectId: string;
  /** Currently linked components (rows from GET /api/issues/[id]/components). */
  value: ProjectComponent[];
  /** Called with the replacement id set (PUT semantics). */
  onChange: (componentIds: string[]) => void;
  disabled?: boolean;
}

export function ComponentPicker({
  projectId,
  value,
  onChange,
  disabled = false,
}: ComponentPickerProps) {
  const t = useTranslations('issueSidebar.components');
  const [open, setOpen] = useState(false);
  const { data: projectComponents, isLoading } = useProjectComponents(projectId);

  const selectedIds = useMemo(() => new Set(value.map((c) => c.id)), [value]);

  // Hide archived components unless they are already linked to the issue.
  const options = useMemo(
    () =>
      (projectComponents ?? []).filter(
        (component) => !component.archived || selectedIds.has(component.id)
      ),
    [projectComponents, selectedIds]
  );

  const handleToggle = (componentId: string) => {
    const next = selectedIds.has(componentId)
      ? value.filter((c) => c.id !== componentId).map((c) => c.id)
      : [...value.map((c) => c.id), componentId];
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
            <span className="truncate">{value.map((c) => c.name).join(', ')}</span>
          ) : (
            <span className="text-muted-foreground">{t('none')}</span>
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
