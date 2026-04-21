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
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      contentClassName="animate-scale-in rounded-xl shadow-lg"
    >
      <CommandInput placeholder="Type a command or search..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Search className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No results found.</span>
          </div>
        </CommandEmpty>

        <CommandGroup
          heading={<span className="kicker">Quick Actions</span>}
        >
          <CommandItem
            onSelect={() => runCommand(() => router.push('/projects'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Issue</span>
            <kbd className="ml-auto inline-flex h-5 select-none items-center rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              C
            </kbd>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/projects'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Create Project</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup
          heading={<span className="kicker">Navigation</span>}
        >
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/projects'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/docs'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <BookOpenText className="mr-2 h-4 w-4" />
            <span>Docs</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/team'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <Users className="mr-2 h-4 w-4" />
            <span>Team</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/settings'))}
            className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        {query.trim().length > 1 && docResults.length > 0 && (
          <CommandGroup heading={<span className="kicker">Docs</span>}>
            {docResults.map((doc) => (
              <CommandItem
                key={doc.id}
                onSelect={() => runCommand(() => router.push(`/docs?pageId=${doc.id}&spaceId=${doc.spaceId}`))}
                className="transition-colors duration-200 aria-selected:bg-primary/10 aria-selected:text-primary"
              >
                <BookOpenText className="mr-2 h-4 w-4 shrink-0" />
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
