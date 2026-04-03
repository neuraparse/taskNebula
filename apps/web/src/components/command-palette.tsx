'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useDocumentSearch } from '@/lib/hooks/use-docs';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search, Plus, Settings, Users, FolderKanban, BookOpenText } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const { data: docResults = [] } = useDocumentSearch({
    query,
    organizationId: currentOrganizationId,
    enabled: open && query.trim().length > 1,
  });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    setQuery('');
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/projects'))}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Issue</span>
            <kbd className="ml-auto text-xs">C</kbd>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/projects'))}
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Create Project</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard'))}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/projects'))}
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/docs'))}
          >
            <BookOpenText className="mr-2 h-4 w-4" />
            <span>Docs</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/team'))}
          >
            <Users className="mr-2 h-4 w-4" />
            <span>Team</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/settings'))}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        {query.trim().length > 1 && docResults.length > 0 && (
          <CommandGroup heading="Docs">
            {docResults.map((doc) => (
              <CommandItem
                key={doc.id}
                onSelect={() => runCommand(() => router.push(`/docs?pageId=${doc.id}&spaceId=${doc.spaceId}`))}
              >
                <BookOpenText className="mr-2 h-4 w-4" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{doc.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{doc.spaceName}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
