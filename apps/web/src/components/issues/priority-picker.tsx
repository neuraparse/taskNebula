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
    color: 'text-red-500',
    bgColor: 'bg-red-500',
  },
  {
    value: 'high',
    label: 'High',
    icon: ArrowUp,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: Minus,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
  },
  {
    value: 'low',
    label: 'Low',
    icon: ArrowDown,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
  },
  {
    value: 'none',
    label: 'None',
    icon: Minus,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500',
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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${selectedPriority?.bgColor || 'bg-gray-500'}`}></div>
            <span className="capitalize">{selectedPriority?.label || 'None'}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                    <div className={`mr-2 h-3 w-3 rounded-full ${priority.bgColor}`}></div>
                    <PriorityIcon className={`mr-2 h-4 w-4 ${priority.color}`} />
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

