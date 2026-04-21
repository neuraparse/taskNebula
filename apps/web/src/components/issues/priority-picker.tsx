'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PriorityPickerProps {
  value: string;
  onChange: (priority: string) => void;
  disabled?: boolean;
}

const priorities = [
  {
    value: 'critical',
    label: 'Critical',
    icon: AlertCircle,
    color: 'text-accent-rose',
    dotClass: 'priority-critical',
  },
  {
    value: 'high',
    label: 'High',
    icon: ArrowUp,
    color: 'text-accent-amber',
    dotClass: 'priority-high',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: Minus,
    color: 'text-accent-blue',
    dotClass: 'priority-medium',
  },
  {
    value: 'low',
    label: 'Low',
    icon: ArrowDown,
    color: 'text-muted-foreground',
    dotClass: 'priority-low',
  },
  {
    value: 'none',
    label: 'None',
    icon: Minus,
    color: 'text-muted-foreground',
    dotClass: 'priority-low',
  },
];

export function PriorityPicker({ value, onChange, disabled = false }: PriorityPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedPriority = priorities.find((p) => p.value === value) || priorities[4];
  const Icon = selectedPriority?.icon || Minus;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Priority"
          className="w-full justify-between h-8 px-2 text-sm rounded-md hover:bg-accent transition-colors duration-150 ease-snap"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className={selectedPriority?.dotClass || 'priority-low'} />
            <span className="capitalize">{selectedPriority?.label || 'None'}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>No priority found.</CommandEmpty>
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
                    <span className="capitalize">{priority.label}</span>
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

