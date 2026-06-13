'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  CircleDot,
  FileText,
  FolderKanban,
  Hash,
  Home,
  Inbox,
  Layers,
  Lightbulb,
  type LucideIcon,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useOrganization } from '@/lib/hooks/use-organization';
import {
  parseFacets,
  activeFacetPicker,
  removeFacet,
  type Facet,
  type FacetKey,
} from '@/lib/command/facets';
import { useOmnibarSearch, type OmnibarTab } from '@/lib/command/use-omnibar-search';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEntry {
  id: string;
  query: string;
  pinned: boolean;
}

interface NavShortcut {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  href: string;
  hint?: string;
}

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */

const TABS: ReadonlyArray<{ key: OmnibarTab; labelKey: string; hotkey: string }> = [
  { key: 'all', labelKey: 'tabAll', hotkey: '1' },
  { key: 'issues', labelKey: 'tabIssues', hotkey: '2' },
  { key: 'docs', labelKey: 'tabDocs', hotkey: '3' },
  { key: 'people', labelKey: 'tabPeople', hotkey: '4' },
  { key: 'ask', labelKey: 'tabAsk', hotkey: '5' },
];

const QUICK_NAV: ReadonlyArray<NavShortcut> = [
  { id: 'nav.home', labelKey: 'navHome', icon: Home, href: '/' },
  { id: 'nav.inbox', labelKey: 'navInbox', icon: Inbox, href: '/inbox' },
  { id: 'nav.work-items', labelKey: 'navWorkItems', icon: CircleDot, href: '/work-items' },
  { id: 'nav.docs', labelKey: 'navDocs', icon: BookOpenText, href: '/docs' },
  { id: 'nav.dashboards', labelKey: 'navDashboards', icon: BarChart3, href: '/dashboards' },
  { id: 'nav.projects', labelKey: 'navProjects', icon: FolderKanban, href: '/projects' },
  { id: 'nav.cycles', labelKey: 'navCycles', icon: RefreshCw, href: '/cycles' },
  { id: 'nav.modules', labelKey: 'navModules', icon: Layers, href: '/modules' },
  { id: 'nav.initiatives', labelKey: 'navInitiatives', icon: Lightbulb, href: '/initiatives' },
  { id: 'nav.team', labelKey: 'navTeam', icon: Users, href: '/team' },
];

const FACET_ICON: Record<FacetKey, LucideIcon> = {
  status: Hash,
  assignee: User,
  project: FolderKanban,
  label: Tag,
  type: Hash,
  priority: Hash,
};

/* -------------------------------------------------------------------------- */
/* Chip                                                                        */
/* -------------------------------------------------------------------------- */

interface FacetChipProps {
  facet: Facet;
  onRemove: () => void;
}

function FacetChip({ facet, onRemove }: FacetChipProps) {
  const t = useTranslations('searchCommand');
  const Icon = FACET_ICON[facet.key] ?? Hash;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-200 backdrop-blur"
      data-testid={`facet-chip-${facet.key}`}
    >
      <Icon className="h-3 w-3 text-zinc-400" aria-hidden />
      <span className="font-medium text-zinc-300">{facet.key}:</span>
      <span className="truncate text-zinc-100">{facet.value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('removeFacetFilter', { key: facet.key })}
        className="ml-0.5 rounded-sm p-0.5 text-zinc-400 hover:text-zinc-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

interface OmnibarTabsProps {
  active: OmnibarTab;
  onChange: (next: OmnibarTab) => void;
}

function OmnibarTabs({ active, onChange }: OmnibarTabsProps) {
  const t = useTranslations('searchCommand');
  return (
    <div
      role="tablist"
      aria-label={t('searchScope')}
      className="flex items-center gap-1 border-b border-white/5 bg-zinc-900/40 px-3 py-2"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              'ease-snap group inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150',
              isActive
                ? 'bg-white/10 text-zinc-50 ring-1 ring-white/15'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            )}
          >
            {t(tab.labelKey)}
            <kbd className="hidden rounded border border-white/10 bg-zinc-950/60 px-1 font-mono text-[10px] text-zinc-500 group-hover:inline-block">
              {tab.hotkey}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline facet picker                                                         */
/* -------------------------------------------------------------------------- */

const FACET_PRESETS: Record<FacetKey, ReadonlyArray<string>> = {
  status: ['todo', 'in_progress', 'review', 'done', 'blocked'],
  priority: ['highest', 'high', 'medium', 'low', 'lowest'],
  type: ['task', 'bug', 'story', 'epic', 'incident'],
  label: ['frontend', 'backend', 'urgent', 'design', 'tech-debt'],
  assignee: ['me', '@unassigned'],
  project: [],
};

interface FacetPickerProps {
  facetKey: FacetKey;
  onPick: (value: string) => void;
  onCancel: () => void;
}

function FacetPicker({ facetKey, onPick, onCancel }: FacetPickerProps) {
  const t = useTranslations('searchCommand');
  const presets = FACET_PRESETS[facetKey];
  return (
    <div
      role="listbox"
      aria-label={t('facetValues', { key: facetKey })}
      className="mx-3 mb-2 mt-1 flex flex-wrap gap-1 rounded-md border border-white/10 bg-zinc-900/60 p-2 backdrop-blur-xl"
    >
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{facetKey}:</span>
      {presets.length === 0 ? (
        <span className="text-[11px] text-zinc-500">{t('typeToFilter')}</span>
      ) : (
        presets.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            className="rounded-md border border-white/5 bg-white/5 px-1.5 py-0.5 text-[11px] text-zinc-200 transition hover:border-white/15 hover:bg-white/10"
          >
            {value}
          </button>
        ))
      )}
      <button
        type="button"
        onClick={onCancel}
        className="ml-auto rounded-md p-1 text-zinc-500 hover:text-zinc-200"
        aria-label={t('closeFacetPicker')}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* History (recents + pinned)                                                  */
/* -------------------------------------------------------------------------- */

function useHistory(organizationId: string | null, open: boolean) {
  const [recents, setRecents] = React.useState<HistoryEntry[]>([]);
  const [pinned, setPinned] = React.useState<HistoryEntry[]>([]);

  React.useEffect(() => {
    if (!open || !organizationId) return;
    const controller = new AbortController();
    const fetchList = async (pinnedOnly: boolean): Promise<HistoryEntry[]> => {
      try {
        const params = new URLSearchParams({
          organizationId,
          limit: pinnedOnly ? '10' : '8',
        });
        if (pinnedOnly) params.set('pinned', 'true');
        const res = await fetch(`/api/search-history?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
          history?: Array<{ id: string; query: string; pinned?: boolean }>;
        };
        return (data.history ?? []).map((h) => ({
          id: h.id,
          query: h.query,
          pinned: Boolean(h.pinned),
        }));
      } catch {
        return [];
      }
    };

    Promise.all([fetchList(true), fetchList(false)]).then(([p, r]) => {
      setPinned(p);
      setRecents(r.filter((entry) => !entry.pinned));
    });

    return () => controller.abort();
  }, [open, organizationId]);

  const togglePin = React.useCallback(async (entry: HistoryEntry) => {
    const next = !entry.pinned;
    // Optimistic update.
    if (next) {
      setPinned((p) => [{ ...entry, pinned: true }, ...p.filter((x) => x.id !== entry.id)]);
      setRecents((r) => r.filter((x) => x.id !== entry.id));
    } else {
      setPinned((p) => p.filter((x) => x.id !== entry.id));
      setRecents((r) => [{ ...entry, pinned: false }, ...r]);
    }
    try {
      await fetch('/api/search-history', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: entry.id, pinned: next }),
      });
    } catch {
      /* swallow — UI already reflects the intent */
    }
  }, []);

  return { recents, pinned, togglePin };
}

/* -------------------------------------------------------------------------- */
/* Main palette                                                                */
/* -------------------------------------------------------------------------- */

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations('searchCommand');
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const [rawInput, setRawInput] = React.useState('');
  const [tab, setTab] = React.useState<OmnibarTab>('all');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset on every open.
  React.useEffect(() => {
    if (open) {
      setRawInput('');
      setTab('all');
    }
  }, [open]);

  const { text: textQuery, facets } = React.useMemo(() => parseFacets(rawInput), [rawInput]);
  const activePicker = React.useMemo(() => activeFacetPicker(rawInput), [rawInput]);

  const search = useOmnibarSearch({
    query: textQuery,
    tab,
    organizationId: currentOrganizationId,
  });

  const history = useHistory(currentOrganizationId, open);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  const navigate = React.useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  const askAi = React.useCallback(
    (prompt: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tasknebula:ask-ai', { detail: { prompt } }));
      }
      // Optimistic fire-and-forget POST so /api/ask starts capturing
      // palette-initiated prompts. The route's zod schema expects `query`
      // (see api/ask/route.ts bodySchema), not `prompt`.
      const body: { query: string; organizationId?: string } = { query: prompt };
      if (currentOrganizationId) {
        body.organizationId = currentOrganizationId;
      }
      fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {
        /* non-blocking — the event above already drives the UI */
      });
      close();
    },
    [close, currentOrganizationId]
  );

  const removeChip = React.useCallback((facet: Facet) => {
    setRawInput((prev) => removeFacet(prev, facet));
    inputRef.current?.focus();
  }, []);

  const appendFacetValue = React.useCallback((value: string) => {
    setRawInput((prev) => `${prev}${value} `);
    inputRef.current?.focus();
  }, []);

  /* ------------------------------------------------------------------ */
  /* Keyboard handlers                                                  */
  /* ------------------------------------------------------------------ */
  const onContentKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Number keys 1–5 switch tabs when input is empty so the user can
      // scope without taking their hands off the keyboard. We respect
      // typing — once the input has content, digits go to the query.
      if (rawInput.length === 0 && /^[1-5]$/.test(event.key) && !event.metaKey && !event.ctrlKey) {
        const idx = parseInt(event.key, 10) - 1;
        const next = TABS[idx];
        if (next) {
          event.preventDefault();
          setTab(next.key);
        }
        return;
      }

      // Tab cycles through tabs.
      if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1;
        const idx = TABS.findIndex((t) => t.key === tab);
        const nextIdx = (idx + direction + TABS.length) % TABS.length;
        const target = TABS[nextIdx];
        if (target) setTab(target.key);
        return;
      }
    },
    [rawInput, tab]
  );

  /* ------------------------------------------------------------------ */
  /* Suggestions                                                        */
  /* ------------------------------------------------------------------ */
  const showRecents = rawInput.trim().length === 0;
  const askPrompt = textQuery.trim();
  // Heuristic: surface the Ask AI CTA when the user has typed a
  // sentence-ish input (more than a single word OR ends with `?`).
  const showAskCta =
    askPrompt.length > 0 && (askPrompt.includes(' ') || askPrompt.endsWith('?') || tab === 'ask');

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={onContentKeyDown}
        className={cn(
          'w-[92vw] max-w-2xl gap-0 overflow-hidden border-0 p-0',
          'left-[50%] top-[18vh] translate-x-[-50%] translate-y-0',
          // Dark glassmorphism per FEAT-25 spec.
          'bg-zinc-900/70 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_24px_48px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl'
        )}
      >
        <DialogTitle className="sr-only">{t('paletteTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('paletteDescription')}</DialogDescription>

        <OmnibarTabs active={tab} onChange={setTab} />

        <Command shouldFilter={false} className="bg-transparent text-zinc-100">
          {/* ---- Input row with inline chips ---- */}
          <div
            className="flex items-center gap-2 border-b border-white/5 px-3 py-2"
            data-cmdk-input-wrapper=""
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {facets.map((facet, index) => (
                <FacetChip
                  key={`${facet.key}:${facet.value}:${index}`}
                  facet={facet}
                  onRemove={() => removeChip(facet)}
                />
              ))}
              <input
                ref={inputRef}
                type="text"
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder={tab === 'ask' ? t('askPlaceholder') : t('searchPlaceholder')}
                autoFocus
                aria-label={t('queryLabel')}
                className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </div>
            <kbd className="hidden rounded border border-white/10 bg-zinc-950/40 px-1 font-mono text-[10px] text-zinc-500 sm:inline-block">
              esc
            </kbd>
          </div>

          {activePicker ? (
            <FacetPicker
              facetKey={activePicker}
              onPick={(value) => appendFacetValue(`"${value}" `)}
              onCancel={() => setRawInput((prev) => prev.replace(/\w+:$/, '').trimEnd())}
            />
          ) : null}

          {/* Surface search failures instead of silently showing "No results". */}
          {search.error ? (
            <div
              role="alert"
              data-testid="omnibar-search-error"
              className="mx-3 mt-2 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300"
            >
              <X className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{search.error}</span>
            </div>
          ) : null}

          <CommandList className="max-h-[480px]">
            <CommandEmpty>
              <div className="flex flex-col items-center gap-1 py-8 text-center">
                <span className="text-sm text-zinc-400">{t('noResults')}</span>
                <span className="text-[11px] text-zinc-600">{t('noResultsHint')}</span>
              </div>
            </CommandEmpty>

            {/* ---- Ask AI CTA ---- */}
            {showAskCta ? (
              <CommandGroup
                heading={<span className="kicker text-zinc-500">{t('aiHeading')}</span>}
              >
                <CommandItem
                  value={`ask:${askPrompt}`}
                  onSelect={() => askAi(askPrompt)}
                  className="group flex items-center gap-2 rounded-md text-zinc-100 data-[selected=true]:bg-violet-500/10 data-[selected=true]:text-violet-100"
                >
                  <Sparkles className="h-4 w-4 text-violet-400" aria-hidden />
                  <span className="flex-1 truncate">
                    {t('askLabel')} <span className="text-zinc-300">&ldquo;{askPrompt}&rdquo;</span>
                  </span>
                  <ArrowRight className="h-3 w-3 text-zinc-500 group-data-[selected=true]:text-violet-300" />
                </CommandItem>
              </CommandGroup>
            ) : null}

            {/* ---- Pinned + recents when input is empty ---- */}
            {showRecents && history.pinned.length > 0 ? (
              <CommandGroup heading={<span className="kicker text-zinc-500">{t('pinned')}</span>}>
                {history.pinned.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`pinned:${entry.id}`}
                    onSelect={() => setRawInput(entry.query)}
                    className="group flex items-center gap-2 rounded-md text-zinc-100 data-[selected=true]:bg-white/5"
                  >
                    <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                    <span className="flex-1 truncate">{entry.query}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        history.togglePin(entry);
                      }}
                      aria-label={t('unpinQuery')}
                      className="opacity-0 transition hover:opacity-100 group-data-[selected=true]:opacity-100"
                    >
                      <PinOff className="h-3 w-3 text-zinc-400" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {showRecents && history.recents.length > 0 ? (
              <>
                <CommandSeparator className="bg-white/5" />
                <CommandGroup
                  heading={<span className="kicker text-zinc-500">{t('recents')}</span>}
                >
                  {history.recents.map((entry) => (
                    <CommandItem
                      key={entry.id}
                      value={`recent:${entry.id}`}
                      onSelect={() => setRawInput(entry.query)}
                      className="group flex items-center gap-2 rounded-md text-zinc-200 data-[selected=true]:bg-white/5"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                      <span className="flex-1 truncate">{entry.query}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          history.togglePin(entry);
                        }}
                        aria-label={t('pinQuery')}
                        className="opacity-0 transition hover:opacity-100 group-data-[selected=true]:opacity-100"
                      >
                        <Pin className="h-3 w-3 text-zinc-400" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {/* ---- Live search results ---- */}
            {!showRecents && search.results.length > 0 ? (
              <CommandGroup
                heading={
                  <span className="kicker flex items-center gap-2 text-zinc-500">
                    {t('results')}
                    {search.loading ? (
                      <span className="text-[10px] text-zinc-600">{t('searching')}</span>
                    ) : null}
                  </span>
                }
              >
                {search.results.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`result:${result.id}`}
                    onSelect={() => navigate(result.href ?? '#')}
                    className="flex items-center gap-2 rounded-md text-zinc-100 data-[selected=true]:bg-white/5"
                  >
                    <CircleDot className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{result.title}</span>
                      {result.subtitle ? (
                        <span className="truncate text-[11px] text-zinc-500">
                          {result.subtitle}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {/* ---- Quick navigation (always visible while empty) ---- */}
            {showRecents ? (
              <>
                <CommandSeparator className="bg-white/5" />
                <CommandGroup
                  heading={<span className="kicker text-zinc-500">{t('navigate')}</span>}
                >
                  {QUICK_NAV.map((nav) => (
                    <CommandItem
                      key={nav.id}
                      value={nav.id}
                      onSelect={() => navigate(nav.href)}
                      className="flex items-center gap-2 rounded-md text-zinc-200 data-[selected=true]:bg-white/5"
                    >
                      <nav.icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                      <span className="flex-1 truncate">{t(nav.labelKey)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>

          {/* ---- Footer hint strip ---- */}
          <div className="flex items-center justify-between gap-3 border-t border-white/5 bg-zinc-950/40 px-3 py-1.5 text-[10px] text-zinc-500">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="rounded border border-white/10 bg-zinc-900/70 px-1 font-mono">
                  ↑
                </kbd>{' '}
                <kbd className="rounded border border-white/10 bg-zinc-900/70 px-1 font-mono">
                  ↓
                </kbd>{' '}
                {t('hintNavigate')}
              </span>
              <span>
                <kbd className="rounded border border-white/10 bg-zinc-900/70 px-1 font-mono">
                  ⏎
                </kbd>{' '}
                {t('hintOpen')}
              </span>
              <span>
                <kbd className="rounded border border-white/10 bg-zinc-900/70 px-1 font-mono">
                  tab
                </kbd>{' '}
                {t('hintCycleTabs')}
              </span>
            </div>
            <span>FEAT-25 omnibar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
