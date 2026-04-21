'use client';

import { useState } from 'react';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinkIssueDialogProps {
  issueId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LINK_TYPES: { value: IssueLinkType; label: string }[] = [
  { value: 'blocks', label: 'blocks' },
  { value: 'blocked_by', label: 'is blocked by' },
  { value: 'relates_to', label: 'relates to' },
  { value: 'duplicates', label: 'duplicates' },
  { value: 'duplicated_by', label: 'is duplicated by' },
  { value: 'parent_of', label: 'is parent of' },
  { value: 'child_of', label: 'is child of' },
];

export function LinkIssueDialog({ issueId, projectId, open, onOpenChange }: LinkIssueDialogProps) {
  const [linkType, setLinkType] = useState<IssueLinkType>('relates_to');
  const [targetIssueId, setTargetIssueId] = useState<string>('');
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);

  const { data: issues } = useIssues({ projectId });
  const createLink = useCreateIssueLink();

  // Filter out the current issue
  const availableIssues = issues?.filter((issue: any) => issue.id !== issueId) || [];

  const selectedIssue = availableIssues.find((issue: any) => issue.id === targetIssueId);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Link Issue</DialogTitle>
          <DialogDescription>Create a relationship between this issue and another issue.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Link Type */}
          <div className="grid gap-2">
            <Label htmlFor="link-type">This issue</Label>
            <Select value={linkType} onValueChange={(value) => setLinkType(value as IssueLinkType)}>
              <SelectTrigger id="link-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue Picker */}
          <div className="grid gap-2">
            <Label>Issue</Label>
            <Popover open={issuePickerOpen} onOpenChange={setIssuePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={issuePickerOpen}
                  className="justify-between"
                >
                  {selectedIssue ? (
                    <span>
                      {selectedIssue.key} - {selectedIssue.title}
                    </span>
                  ) : (
                    'Select issue...'
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0 z-[60]">
                <Command>
                  <CommandInput placeholder="Search issues..." />
                  <CommandEmpty>No issue found.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-auto">
                    {availableIssues.map((issue: any) => (
                      <CommandItem
                        key={issue.id}
                        value={`${issue.key} ${issue.title}`}
                        onSelect={() => {
                          setTargetIssueId(issue.id);
                          setIssuePickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            targetIssueId === issue.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{issue.key}</span>
                          <span className="text-sm text-muted-foreground">{issue.title}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!targetIssueId || createLink.isPending}>
            {createLink.isPending ? 'Creating...' : 'Create link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

