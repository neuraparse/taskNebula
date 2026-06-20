'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, GitBranch, X } from 'lucide-react';
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
import { useIssues, type Issue } from '@/lib/hooks/use-issues';
import { collectExcludedParentIds } from './issue-hierarchy';
import { cn } from '@/lib/utils';

/** The list API returns `parentId` but the shared `Issue` hook shape omits it. */
type IssueWithParent = Issue & { parentId?: string | null };

interface ParentPickerProps {
  projectId: string;
  /** The issue being edited — excluded from candidates along with its descendants. */
  issueId: string;
  value: string | null;
  onChange: (parentId: string | null) => void;
  disabled?: boolean;
}

export function ParentPicker({
  projectId,
  issueId,
  value,
  onChange,
  disabled = false,
}: ParentPickerProps) {
  const t = useTranslations('issueSidebar.parent');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useIssues({ projectId });

  const allIssues = (data ?? []) as IssueWithParent[];
  // Best-effort cycle guard: an issue cannot be parented to itself or to any
  // of its (loaded) descendants.
  const excluded = collectExcludedParentIds(allIssues, issueId);
  const candidates = allIssues.filter((candidate) => !excluded.has(candidate.id));
  const selected = value ? allIssues.find((candidate) => candidate.id === value) : null;

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
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <GitBranch className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="text-muted-foreground font-mono text-[11px]">{selected.key}</span>
              <span className="truncate">{selected.title}</span>
            </span>
          ) : (
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{t('none')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder={t('search')} />
          <CommandList>
            <CommandEmpty>{t('empty')}</CommandEmpty>
            <CommandGroup>
              {/* No-parent option */}
              <CommandItem
                value="__no_parent__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                <X className="text-muted-foreground mr-2 h-3.5 w-3.5" />
                <span className="text-muted-foreground">{t('none')}</span>
              </CommandItem>

              {candidates.map((candidate) => (
                <CommandItem
                  key={candidate.id}
                  value={`${candidate.key} ${candidate.title}`}
                  onSelect={() => {
                    onChange(candidate.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === candidate.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="text-muted-foreground mr-2 font-mono text-[10px]">
                    {candidate.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{candidate.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
