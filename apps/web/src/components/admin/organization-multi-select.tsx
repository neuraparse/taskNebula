'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function OrganizationMultiSelect({
  value,
  onChange,
  placeholder,
}: OrganizationMultiSelectProps) {
  const t = useTranslations('adminDialogs');
  const [open, setOpen] = useState(false);
  const resolvedPlaceholder = placeholder ?? t('orgMultiSelect.allOrganizations');

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['admin-organizations-options'],
    queryFn: async () => {
      const response = await fetch('/api/admin/organizations?limit=200');
      if (!response.ok) throw new Error('Failed to load organizations');
      const payload = (await response.json()) as {
        organizations: Array<{ id: string; name: string; slug: string }>;
      };
      return payload.organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })) as OrgOption[];
    },
  });

  const byId = useMemo(() => {
    const map = new Map<string, OrgOption>();
    for (const org of orgs) map.set(org.id, org);
    return map;
  }, [orgs]);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-sm">
              {value.length === 0
                ? resolvedPlaceholder
                : t('orgMultiSelect.selectedCount', { count: value.length })}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('orgMultiSelect.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>
                {isLoading ? t('common.loading') : t('orgMultiSelect.empty')}
              </CommandEmpty>
              <CommandGroup>
                {orgs.map((org) => {
                  const selected = value.includes(org.id);
                  return (
                    <CommandItem
                      key={org.id}
                      value={`${org.name} ${org.slug}`}
                      onSelect={() => toggle(org.id)}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')}
                      />
                      <span className="truncate">{org.name}</span>
                      <span className="text-muted-foreground ml-2 truncate font-mono text-xs">
                        {org.slug}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const org = byId.get(id);
            return (
              <span key={id} className="chip flex items-center gap-1 text-xs">
                {org?.name ?? id}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="rounded p-0.5 opacity-60 hover:opacity-100"
                  aria-label={t('orgMultiSelect.remove', { name: org?.name ?? id })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
