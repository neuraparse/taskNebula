'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PriorityPickerProps {
  value: string;
  onChange: (priority: string) => void;
  disabled?: boolean;
}

const priorities = [
  {
    value: 'critical',
    labelKey: 'priority_critical',
    icon: AlertCircle,
    color: 'text-accent-rose',
    dotClass: 'priority-critical',
  },
  {
    value: 'high',
    labelKey: 'priority_high',
    icon: ArrowUp,
    color: 'text-accent-amber',
    dotClass: 'priority-high',
  },
  {
    value: 'medium',
    labelKey: 'priority_medium',
    icon: Minus,
    color: 'text-accent-blue',
    dotClass: 'priority-medium',
  },
  {
    value: 'low',
    labelKey: 'priority_low',
    icon: ArrowDown,
    color: 'text-muted-foreground',
    dotClass: 'priority-low',
  },
  {
    value: 'none',
    labelKey: 'priority_none',
    icon: Minus,
    color: 'text-muted-foreground',
    dotClass: 'priority-low',
  },
] as const;

export function PriorityPicker({ value, onChange, disabled = false }: PriorityPickerProps) {
  const t = useTranslations('issueMisc');
  const [open, setOpen] = useState(false);

  const selectedPriority = priorities.find((p) => p.value === value) || priorities[4];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t('priority_label')}
          className="hover:bg-accent ease-snap h-8 w-full justify-between rounded-md px-2 text-sm transition-colors duration-150"
          disabled={disabled}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('shrink-0', selectedPriority?.dotClass || 'priority-low')}
            />
            <span className="truncate capitalize">
              {selectedPriority ? t(selectedPriority.labelKey) : t('priority_none')}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] max-w-[calc(100vw-2rem)] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>{t('no_priority_found')}</CommandEmpty>
            <CommandGroup>
              {priorities.map((priority) => {
                const PriorityIcon = priority.icon;
                return (
                  <CommandItem
                    key={priority.value}
                    value={priority.value}
                    onSelect={() => {
                      onChange(priority.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === priority.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span aria-hidden="true" className={`mr-2 ${priority.dotClass}`} />
                    <PriorityIcon className={`mr-1.5 h-3.5 w-3.5 ${priority.color}`} />
                    <span className="capitalize">{t(priority.labelKey)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
