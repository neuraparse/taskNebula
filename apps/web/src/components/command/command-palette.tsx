'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  CircleDot,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  Inbox,
  Keyboard,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  type LucideIcon,
  Plus,
  RefreshCw,
  SunMoon,
  Users,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type Leader = 'G' | 'O' | 'N';

interface ChordAction {
  /** Single uppercase letter pressed after the leader. */
  key: string;
  /** Visible label. */
  label: string;
  /** Lucide icon shown on the leading edge of the row. */
  icon: LucideIcon;
  /** Either a navigation href or a side-effect callback. */
  href?: string;
  onSelect?: () => void;
  /** Optional hint shown right of label, e.g. "create". */
  hint?: string;
}

interface RecentItem {
  id: string;
  label: string;
  href: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/* Static chord definitions (Plane Power-K 2.0 grammar)                        */
/* -------------------------------------------------------------------------- */

const NAVIGATE_CHORDS: ChordAction[] = [
  { key: 'I', label: 'Work items', icon: CircleDot, href: '/work-items' },
  { key: 'P', label: 'Pages', icon: FileText, href: '/pages' },
  { key: 'C', label: 'Cycles', icon: RefreshCw, href: '/cycles' },
  { key: 'M', label: 'Modules', icon: Layers, href: '/modules' },
  { key: 'N', label: 'Initiatives', icon: Lightbulb, href: '/initiatives' },
  { key: 'D', label: 'Dashboards', icon: BarChart3, href: '/dashboards' },
  { key: 'X', label: 'Inbox', icon: Inbox, href: '/inbox' },
  { key: 'H', label: 'Home', icon: Home, href: '/' },
  { key: 'T', label: 'Teamspaces', icon: Users, href: '/teamspaces' },
];

const CREATE_CHORDS: ChordAction[] = [
  { key: 'I', label: 'New work item', icon: CircleDot, hint: 'Create' },
  { key: 'D', label: 'New page', icon: FileText, hint: 'Create' },
  { key: 'P', label: 'New project', icon: FolderKanban, hint: 'Create' },
  { key: 'C', label: 'New cycle', icon: RefreshCw, hint: 'Create' },
  { key: 'M', label: 'New module', icon: Layers, hint: 'Create' },
  { key: 'V', label: 'New view', icon: LayoutDashboard, hint: 'Create' },
  { key: 'B', label: 'New dashboard', icon: BarChart3, hint: 'Create' },
];

/** Open-specific-item leader (project picker placeholder). */
const OPEN_CHORDS: ChordAction[] = [
  { key: 'P', label: 'Open project…', icon: FolderKanban, hint: 'Open' },
  { key: 'I', label: 'Open work item…', icon: CircleDot, hint: 'Open' },
  { key: 'D', label: 'Open page…', icon: FileText, hint: 'Open' },
];

const HELP_ITEMS: ReadonlyArray<{
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  onSelect: () => void;
}> = [
  {
    id: 'help.shortcuts',
    label: 'Keyboard shortcuts',
    icon: Keyboard,
    shortcut: '⌘ + /',
    onSelect: () => console.info('[command-palette] open keyboard shortcuts'),
  },
  {
    id: 'help.theme',
    label: 'Toggle theme',
    icon: SunMoon,
    onSelect: () => console.info('[command-palette] toggle theme'),
  },
  {
    id: 'help.signout',
    label: 'Sign out',
    icon: LogOut,
    onSelect: () => console.info('[command-palette] sign out'),
  },
];

const LEADER_LABEL: Record<Leader, string> = {
  G: 'Go to',
  O: 'Open',
  N: 'New',
};

const RECENTS_STORAGE_KEY = 'tn:command-recents';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function readRecentsSafely(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is RecentItem =>
          typeof it === 'object' &&
          it !== null &&
          typeof (it as { id?: unknown }).id === 'string' &&
          typeof (it as { label?: unknown }).label === 'string' &&
          typeof (it as { href?: unknown }).href === 'string'
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

function isPrintableLetter(key: string): boolean {
  return key.length === 1 && /^[a-zA-Z]$/.test(key);
}

function chordsForLeader(leader: Leader): ChordAction[] {
  switch (leader) {
    case 'G':
      return NAVIGATE_CHORDS;
    case 'O':
      return OPEN_CHORDS;
    case 'N':
      return CREATE_CHORDS;
  }
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

interface PaletteRowProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  hint?: string;
  value: string;
  onSelect: () => void;
}

function PaletteRow({ icon: Icon, label, shortcut, hint, value, onSelect }: PaletteRowProps) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </span>
      ) : null}
      {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
}

/* -------------------------------------------------------------------------- */
/* Main palette                                                                */
/* -------------------------------------------------------------------------- */

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [leader, setLeader] = React.useState<Leader | null>(null);
  const [recents, setRecents] = React.useState<RecentItem[]>([]);

  // Reset transient state every time the dialog re-opens.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setLeader(null);
      setRecents(readRecentsSafely());
    }
  }, [open]);

  const close = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const runAction = React.useCallback(
    (action: ChordAction) => {
      if (action.href) {
        router.push(action.href);
      } else if (action.onSelect) {
        action.onSelect();
      } else {
        console.info('[command-palette] action triggered (no handler)', action.label);
      }
      close();
    },
    [router, close]
  );

  const navigate = React.useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  /* ------------------------------------------------------------------ */
  /* Chord (leader -> letter) handling                                  */
  /* ------------------------------------------------------------------ */
  const onContentKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // ESC: cancel leader first, then close.
      if (event.key === 'Escape') {
        if (leader) {
          event.preventDefault();
          event.stopPropagation();
          setLeader(null);
          return;
        }
        return;
      }

      // Ignore key chords with modifiers (let cmdk / browser handle them).
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // We only want to capture chords when the input is empty — once the
      // user is actively searching, chord-mode would steal their letters.
      if (query.length > 0) return;

      const key = event.key;
      if (!isPrintableLetter(key)) return;

      const upper = key.toUpperCase();

      if (!leader) {
        if (upper === 'G' || upper === 'O' || upper === 'N') {
          event.preventDefault();
          setLeader(upper);
        }
        return;
      }

      // Leader is set — try to resolve the leaf.
      const leaf = chordsForLeader(leader).find((c) => c.key === upper);
      if (leaf) {
        event.preventDefault();
        setLeader(null);
        runAction(leaf);
      } else {
        // Unknown leaf cancels the chord rather than swallowing the key.
        event.preventDefault();
        setLeader(null);
      }
    },
    [leader, query, runAction]
  );

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
  const visibleNavigate = leader === 'G' ? NAVIGATE_CHORDS : NAVIGATE_CHORDS;
  const visibleCreate = leader === 'N' ? CREATE_CHORDS : CREATE_CHORDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={onContentKeyDown}
        className={cn(
          'p-0 gap-0 max-w-xl w-[92vw] overflow-hidden',
          // Override default centered position: anchor near the top.
          'left-[50%] top-[20vh] translate-x-[-50%] translate-y-0'
        )}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search, navigate, and trigger quick actions across taskNebula.
        </DialogDescription>

        <Command
          // Disable cmdk's own filtering when we're in chord mode so chord
          // letters don't accidentally narrow the list.
          shouldFilter={!leader}
          className="bg-popover"
        >
          <CommandInput
            placeholder="Search or jump to…"
            value={query}
            onValueChange={setQuery}
            autoFocus
          />

          {leader ? (
            <div
              role="status"
              className="flex items-center justify-between gap-2 border-b border-border bg-accent/30 px-3 py-2 text-xs text-muted-foreground"
            >
              <span>
                Press a key for{' '}
                <span className="font-semibold text-foreground">{LEADER_LABEL[leader]}</span> action
              </span>
              <span className="text-[10px] uppercase tracking-wider">Press ESC to cancel</span>
            </div>
          ) : null}

          <CommandList className="max-h-[480px]">
            <CommandEmpty>
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No results found.</span>
              </div>
            </CommandEmpty>

            {/* Quick actions — surfaces top matches based on current query.
                cmdk handles the actual fuzzy filtering automatically. */}
            <CommandGroup heading="Quick actions">
              <PaletteRow
                value="quick.create.work-item"
                icon={Plus}
                label="Create work item"
                shortcut="N I"
                onSelect={() =>
                  runAction({ key: 'I', label: 'New work item', icon: CircleDot })
                }
              />
              <PaletteRow
                value="quick.go.inbox"
                icon={Inbox}
                label="Go to inbox"
                shortcut="G X"
                onSelect={() => navigate('/inbox')}
              />
              <PaletteRow
                value="quick.go.dashboards"
                icon={BarChart3}
                label="Go to dashboards"
                shortcut="G D"
                onSelect={() => navigate('/dashboards')}
              />
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navigate">
              {visibleNavigate.map((c) => (
                <PaletteRow
                  key={`nav.${c.key}`}
                  value={`nav.${c.key}.${c.label}`}
                  icon={c.icon}
                  label={c.label}
                  shortcut={`G ${c.key}`}
                  onSelect={() => runAction(c)}
                />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Create">
              {visibleCreate.map((c) => (
                <PaletteRow
                  key={`new.${c.key}`}
                  value={`new.${c.key}.${c.label}`}
                  icon={c.icon}
                  label={c.label}
                  shortcut={`N ${c.key}`}
                  onSelect={() =>
                    runAction({
                      ...c,
                      onSelect:
                        c.onSelect ??
                        (() => console.info(`[command-palette] create:${c.label}`)),
                    })
                  }
                />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Recent">
              {recents.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No recent items yet.
                </div>
              ) : (
                recents.map((r) => (
                  <PaletteRow
                    key={`recent.${r.id}`}
                    value={`recent.${r.id}.${r.label}`}
                    icon={Calendar}
                    label={r.label}
                    onSelect={() => navigate(r.href)}
                  />
                ))
              )}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Help">
              {HELP_ITEMS.map((h) => (
                <PaletteRow
                  key={h.id}
                  value={h.id}
                  icon={h.icon}
                  label={h.label}
                  shortcut={h.shortcut}
                  onSelect={() => {
                    h.onSelect();
                    close();
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
