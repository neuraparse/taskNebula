'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateIssueLink, IssueLinkType } from '@/lib/hooks/use-issue-links';
import { useIssues } from '@/lib/hooks/use-issues';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkIssueDialogProps {
  issueId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Only the relationship types the backend actually persists (see
// `issueLinkTypeEnum` in packages/db and the POST /links Zod schema).
// Standard Jira/Plane parity set; hierarchy types live in their own picker.
const LINK_TYPE_ORDER: IssueLinkType[] = [
  'blocks',
  'blocked_by',
  'relates_to',
  'duplicates',
  'duplicated_by',
];

export function LinkIssueDialog({ issueId, projectId, open, onOpenChange }: LinkIssueDialogProps) {
  const t = useTranslations('issueRelations');
  const [linkType, setLinkType] = useState<IssueLinkType>('relates_to');
  const [targetIssueId, setTargetIssueId] = useState<string>('');
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);

  const { data: issues } = useIssues({ projectId });
  const createLink = useCreateIssueLink();

  // Filter out the current issue
  const availableIssues = useMemo(
    () => issues?.filter((issue: { id: string }) => issue.id !== issueId) ?? [],
    [issues, issueId]
  );

  const selectedIssue = availableIssues.find((issue: { id: string }) => issue.id === targetIssueId);

  const handleSubmit = async () => {
    if (!targetIssueId) return;

    try {
      await createLink.mutateAsync({
        issueId,
        targetIssueId,
        type: linkType,
      });
      onOpenChange(false);
      setTargetIssueId('');
      setLinkType('relates_to');
    } catch (error) {
      console.error('Failed to create link:', error);
    }
  };

  // Friendly verb for each relationship type (outbound phrasing).
  const typeLabel = (type: IssueLinkType): string => {
    switch (type) {
      case 'blocks':
        return t('type.blocks');
      case 'blocked_by':
        return t('type.blockedBy');
      case 'relates_to':
        return t('type.relatesTo');
      case 'duplicates':
        return t('type.duplicates');
      case 'duplicated_by':
        return t('type.duplicatedBy');
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Relationship type */}
          <div className="grid gap-2">
            <Label htmlFor="link-type" className="text-muted-foreground text-xs">
              {t('relationshipLabel')}
            </Label>
            <Select value={linkType} onValueChange={(value) => setLinkType(value as IssueLinkType)}>
              <SelectTrigger id="link-type" className="rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPE_ORDER.map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="capitalize">{typeLabel(type)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue picker */}
          <div className="grid gap-2">
            <Label className="text-muted-foreground text-xs">{t('issueLabel')}</Label>
            <Popover open={issuePickerOpen} onOpenChange={setIssuePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={issuePickerOpen}
                  className="justify-between rounded-md font-normal"
                >
                  {selectedIssue ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="chip shrink-0 rounded-sm font-mono text-[11px]">
                        {selectedIssue.key}
                      </span>
                      <span className="truncate">{selectedIssue.title}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('selectIssue')}</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[60] w-[400px] rounded-md p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder={t('searchPlaceholder')} />
                  <CommandEmpty>
                    <div className="text-muted-foreground flex flex-col items-center gap-1.5 py-4 text-sm">
                      <Search className="h-4 w-4 opacity-50" />
                      {t('noIssueFound')}
                    </div>
                  </CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-auto">
                    {availableIssues.map(
                      (issue: { id: string; key: string; title: string; priority?: string }) => {
                        const priorityChip =
                          issue.priority === 'critical'
                            ? 'chip-rose'
                            : issue.priority === 'high'
                              ? 'chip-amber'
                              : issue.priority === 'medium'
                                ? 'chip-blue'
                                : 'chip';
                        return (
                          <CommandItem
                            key={issue.id}
                            value={`${issue.key} ${issue.title}`}
                            onSelect={() => {
                              setTargetIssueId(issue.id);
                              setIssuePickerOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                'h-4 w-4 shrink-0',
                                targetIssueId === issue.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="chip shrink-0 rounded-sm font-mono text-[11px]">
                              {issue.key}
                            </span>
                            <span className="truncate text-sm">{issue.title}</span>
                            {issue.priority && (
                              <span
                                className={cn(
                                  priorityChip,
                                  'ml-auto shrink-0 text-[10px] capitalize'
                                )}
                              >
                                {issue.priority}
                              </span>
                            )}
                          </CommandItem>
                        );
                      }
                    )}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedIssue && (
              <p className="text-muted-foreground text-[11px]">
                {t('preview', {
                  relationship: typeLabel(linkType),
                  key: selectedIssue.key,
                })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!targetIssueId || createLink.isPending}>
            {createLink.isPending ? t('creating') : t('createLink')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
