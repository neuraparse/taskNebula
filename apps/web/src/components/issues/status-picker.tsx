'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStatus {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface StatusPickerProps {
  projectId: string;
  value: string; // statusId
  onChange: (statusId: string) => void;
  disabled?: boolean;
}

export function StatusPicker({ projectId, value, onChange, disabled }: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatuses() {
      try {
        const response = await fetch(`/api/projects/${projectId}/workflow-statuses`);
        if (response.ok) {
          const data = await response.json();
          setStatuses(data.statuses || []);
        }
      } catch (error) {
        console.error('Error fetching statuses:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStatuses();
  }, [projectId]);

  const selectedStatus = statuses.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 px-2 text-sm rounded-md hover:bg-accent transition-colors duration-150 ease-snap"
          disabled={disabled || loading}
        >
          {selectedStatus ? (
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedStatus.color }}
              />
              {selectedStatus.name}
            </div>
          ) : (
            'Select status...'
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search status..." />
          <CommandEmpty>No status found.</CommandEmpty>
          <CommandGroup>
            {statuses.map((status) => (
              <CommandItem
                key={status.id}
                value={status.name}
                onSelect={() => {
                  onChange(status.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === status.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div
                  className="mr-2 h-2 w-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

