'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrganizationMembers } from '@/lib/hooks/use-members';
import { cn } from '@/lib/utils';

interface AssigneePickerProps {
  organizationId: string | null;
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
}

export function AssigneePicker({
  organizationId,
  value,
  onChange,
  disabled = false,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useOrganizationMembers(organizationId);

  const members = data?.members || [];

  const selectedMember = members.find((member) => member.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 px-2 text-sm rounded-md hover:bg-accent transition-colors duration-150 ease-snap"
          disabled={disabled || isLoading}
        >
          {selectedMember ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={selectedMember.image || undefined}
                  alt={selectedMember.name ?? selectedMember.email ?? 'Member avatar'}
                />
                <AvatarFallback className="text-xs">
                  {selectedMember.name?.[0] || selectedMember.email?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {selectedMember.name || selectedMember.email}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Unassigned</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search members..." />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              {/* Unassigned option */}
              <CommandItem
                value="unassigned"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Unassigned</span>
              </CommandItem>

              {/* Members list */}
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.name || member.email || member.id}
                  onSelect={() => {
                    onChange(member.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === member.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Avatar className="mr-2 h-5 w-5">
                    <AvatarImage src={member.image || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.name?.[0] || member.email?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm">{member.name || 'Unnamed'}</span>
                    {member.email && (
                      <span className="text-xs text-muted-foreground">
                        {member.email}
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

