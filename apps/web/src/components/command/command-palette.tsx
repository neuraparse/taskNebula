'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  BookOpenText,
  CircleDot,
  FileText,
  FolderKanban,
  Hash,
  Home,
  Inbox,
  Lightbulb,
  type LucideIcon,
  Pin,
  PinOff,
  Search,
  Settings,
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
import { useOrganizationPermissions, type Permission } from '@/lib/hooks/use-permissions';
import {
  parseFacets,
  activeFacetPicker,
  removeFacet,
  type Facet,
  type FacetKey,
} from '@/lib/command/facets';
import {
  useOmnibarSearch,
  type OmnibarResult,
  type OmnibarTab,
} from '@/lib/command/use-omnibar-search';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasWorkspaceAccess?: boolean;
}

interface HistoryEntry {
  id: string;
  query: string;
  pinned: boolean;
}

interface NavShortcut {
  id: string;
  labelKey: string;
  labelNamespace?: 'nav' | 'searchCommand';
  icon: LucideIcon;
  href: string;
  hint?: string;
  requiredAnyPermissions?: Permission[];
}

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */

type OmnibarTabConfig = { key: OmnibarTab; labelKey: string; hotkey: string };

const TABS: ReadonlyArray<OmnibarTabConfig> = [
  { key: 'all', labelKey: 'tabAll', hotkey: '1' },
  { key: 'issues', labelKey: 'tabIssues', hotkey: '2' },
  { key: 'docs', labelKey: 'tabDocs', hotkey: '3' },
  { key: 'people', labelKey: 'tabPeople', hotkey: '4' },
  { key: 'ask', labelKey: 'tabAsk', hotkey: '5' },
];

const QUICK_NAV: ReadonlyArray<NavShortcut> = [
  { id: 'nav.home', labelKey: 'home', labelNamespace: 'nav', icon: Home, href: '/dashboard' },
  { id: 'nav.inbox', labelKey: 'inbox', labelNamespace: 'nav', icon: Inbox, href: '/inbox' },
  {
    id: 'nav.my-issues',
    labelKey: 'my_issues',
    labelNamespace: 'nav',
    icon: CircleDot,
    href: '/my-issues',
  },
  { id: 'nav.docs', labelKey: 'docs', labelNamespace: 'nav', icon: BookOpenText, href: '/docs' },
  {
    id: 'nav.projects',
    labelKey: 'projects',
    labelNamespace: 'nav',
    icon: FolderKanban,
    href: '/projects',
  },
  { id: 'nav.initiatives', labelKey: 'navInitiatives', icon: Lightbulb, href: '/initiatives' },
  { id: 'nav.drafts', labelKey: 'drafts', labelNamespace: 'nav', icon: FileText, href: '/drafts' },
  {
    id: 'nav.templates',
    labelKey: 'templates',
    labelNamespace: 'nav',
    icon: Pin,
    href: '/templates',
  },
  {
    id: 'nav.team',
    labelKey: 'team',
    labelNamespace: 'nav',
    icon: Users,
    href: '/team',
    requiredAnyPermissions: ['member:view', 'team:view'],
  },
  {
    id: 'nav.settings',
    labelKey: 'settings',
    labelNamespace: 'nav',
    icon: Settings,
    href: '/settings',
  },
];
const PERSONAL_QUICK_NAV_IDS = new Set(['nav.home', 'nav.settings']);

const FACET_ICON: Record<FacetKey, LucideIcon> = {
  status: Hash,
  assignee: User,
  project: FolderKanban,
  label: Tag,
  type: Hash,
  priority: Hash,
};

const RESULT_ICON: Record<OmnibarResult['type'], LucideIcon> = {
  issue: CircleDot,
  doc: BookOpenText,
  person: User,
  ai: Sparkles,
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
      className="border-border bg-muted text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] backdrop-blur"
      data-testid={`facet-chip-${facet.key}`}
    >
      <Icon className="text-muted-foreground h-3 w-3" aria-hidden />
      <span className="text-muted-foreground font-medium">
        {facet.key}
        {':'}
      </span>
      <span className="text-foreground truncate">{facet.value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('removeFacetFilter', { key: facet.key })}
        className="text-muted-foreground hover:text-foreground ml-0.5 rounded-sm p-0.5"
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
  tabs: ReadonlyArray<OmnibarTabConfig>;
}

function OmnibarTabs({ active, onChange, tabs }: OmnibarTabsProps) {
  const t = useTranslations('searchCommand');
  return (
    <div
      role="tablist"
      aria-label={t('searchScope')}
      className="border-border bg-muted flex items-center gap-1 border-b px-3 py-2"
    >
      {tabs.map((tab) => {
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
                ? 'bg-accent text-foreground ring-border ring-1'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {t(tab.labelKey)}
            <kbd className="border-border bg-muted text-muted-foreground hidden rounded border px-1 font-mono text-[10px] group-hover:inline-block">
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
  status: ['backlog', 'in_progress', 'in_review', 'done', 'blocked'],
  priority: ['critical', 'high', 'medium', 'low', 'none'],
  type: ['task', 'bug', 'story', 'epic', 'subtask'],
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
      className="border-border bg-muted mx-3 mb-2 mt-1 flex flex-wrap gap-1 rounded-md border p-2 backdrop-blur-xl"
    >
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
        {facetKey}
        {':'}
      </span>
      {presets.length === 0 ? (
        <span className="text-muted-foreground text-[11px]">{t('typeToFilter')}</span>
      ) : (
        presets.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            className="border-border bg-muted text-foreground hover:border-border hover:bg-accent rounded-md border px-1.5 py-0.5 text-[11px] transition"
          >
            {value}
          </button>
        ))
      )}
      <button
        type="button"
        onClick={onCancel}
        className="text-muted-foreground hover:text-foreground ml-auto rounded-md p-1"
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

export function CommandPalette({
  open,
  onOpenChange,
  hasWorkspaceAccess = true,
}: CommandPaletteProps) {
  const t = useTranslations('searchCommand');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const { currentOrganizationId } = useOrganization();
  const { hasAny: hasAnyOrgPermission, isLoading: isLoadingOrgPermissions } =
    useOrganizationPermissions(currentOrganizationId ?? undefined);
  const [rawInput, setRawInput] = React.useState('');
  const [tab, setTab] = React.useState<OmnibarTab>('all');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const visibleTabs = React.useMemo(
    () => (hasWorkspaceAccess ? TABS : TABS.filter((item) => item.key === 'all')),
    [hasWorkspaceAccess]
  );
  const visibleQuickNav = React.useMemo(() => {
    const workspaceScoped = hasWorkspaceAccess
      ? QUICK_NAV
      : QUICK_NAV.filter((item) => PERSONAL_QUICK_NAV_IDS.has(item.id));

    return workspaceScoped.filter((item) => {
      if (!item.requiredAnyPermissions) return true;
      return !isLoadingOrgPermissions && hasAnyOrgPermission(item.requiredAnyPermissions);
    });
  }, [hasAnyOrgPermission, hasWorkspaceAccess, isLoadingOrgPermissions]);
  const navLabel = React.useCallback(
    (shortcut: NavShortcut) =>
      shortcut.labelNamespace === 'nav' ? tNav(shortcut.labelKey) : t(shortcut.labelKey),
    [t, tNav]
  );

  // Reset on every open.
  React.useEffect(() => {
    if (open) {
      setRawInput('');
      setTab('all');
    }
  }, [open]);

  React.useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab)) {
      setTab('all');
    }
  }, [tab, visibleTabs]);

  const { text: textQuery, facets } = React.useMemo(() => parseFacets(rawInput), [rawInput]);
  const activePicker = React.useMemo(() => activeFacetPicker(rawInput), [rawInput]);

  const search = useOmnibarSearch({
    query: textQuery,
    tab,
    organizationId: hasWorkspaceAccess ? currentOrganizationId : null,
    facets,
  });

  const history = useHistory(hasWorkspaceAccess ? currentOrganizationId : null, open);

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
      if (!hasWorkspaceAccess) {
        return;
      }
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
    [close, currentOrganizationId, hasWorkspaceAccess]
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
        const next = visibleTabs[idx];
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
        const idx = visibleTabs.findIndex((t) => t.key === tab);
        const nextIdx = (idx + direction + visibleTabs.length) % visibleTabs.length;
        const target = visibleTabs[nextIdx];
        if (target) setTab(target.key);
        return;
      }
    },
    [rawInput, tab, visibleTabs]
  );

  /* ------------------------------------------------------------------ */
  /* Suggestions                                                        */
  /* ------------------------------------------------------------------ */
  const showRecents = rawInput.trim().length === 0;
  const askPrompt = textQuery.trim();
  // Heuristic: surface the Ask AI CTA when the user has typed a
  // sentence-ish input (more than a single word OR ends with `?`).
  const showAskCta =
    hasWorkspaceAccess &&
    askPrompt.length > 0 &&
    (askPrompt.includes(' ') || askPrompt.endsWith('?') || tab === 'ask');

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
          // Theme-aware glass surface (light: frosted white, dark: frosted dark).
          'glass-panel'
        )}
      >
        <DialogTitle className="sr-only">{t('paletteTitle')}</DialogTitle>
        <DialogDescription className="sr-only">
          {hasWorkspaceAccess ? t('paletteDescription') : t('navigate')}
        </DialogDescription>

        <OmnibarTabs active={tab} onChange={setTab} tabs={visibleTabs} />

        <Command shouldFilter={false} className="text-foreground bg-transparent">
          {/* ---- Input row with inline chips ---- */}
          <div
            className="border-border flex items-center gap-2 border-b px-3 py-2"
            data-cmdk-input-wrapper=""
          >
            <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
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
                className="text-foreground placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <kbd className="border-border bg-muted text-muted-foreground hidden rounded border px-1 font-mono text-[10px] sm:inline-block">
              {'esc'}
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
                <span className="text-muted-foreground text-sm">{t('noResults')}</span>
                <span className="text-muted-foreground/60 text-[11px]">{t('noResultsHint')}</span>
              </div>
            </CommandEmpty>

            {/* ---- Ask AI CTA ---- */}
            {showAskCta ? (
              <CommandGroup
                heading={<span className="kicker text-muted-foreground">{t('aiHeading')}</span>}
              >
                <CommandItem
                  value={`ask:${askPrompt}`}
                  onSelect={() => askAi(askPrompt)}
                  className="text-foreground group flex items-center gap-2 rounded-md data-[selected=true]:bg-violet-500/10 data-[selected=true]:text-violet-100"
                >
                  <Sparkles className="h-4 w-4 text-violet-400" aria-hidden />
                  <span className="flex-1 truncate">
                    {t('askLabel')}{' '}
                    <span className="text-muted-foreground">
                      {'“'}
                      {askPrompt}
                      {'”'}
                    </span>
                  </span>
                  <ArrowRight className="text-muted-foreground h-3 w-3 group-data-[selected=true]:text-violet-300" />
                </CommandItem>
              </CommandGroup>
            ) : null}

            {/* ---- Pinned + recents when input is empty ---- */}
            {showRecents && history.pinned.length > 0 ? (
              <CommandGroup
                heading={<span className="kicker text-muted-foreground">{t('pinned')}</span>}
              >
                {history.pinned.map((entry) => (
                  <CommandItem
                    key={entry.id}
                    value={`pinned:${entry.id}`}
                    onSelect={() => setRawInput(entry.query)}
                    className="text-foreground data-[selected=true]:bg-accent group flex items-center gap-2 rounded-md"
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
                      <PinOff className="text-muted-foreground h-3 w-3" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {showRecents && history.recents.length > 0 ? (
              <>
                <CommandSeparator className="bg-border" />
                <CommandGroup
                  heading={<span className="kicker text-muted-foreground">{t('recents')}</span>}
                >
                  {history.recents.map((entry) => (
                    <CommandItem
                      key={entry.id}
                      value={`recent:${entry.id}`}
                      onSelect={() => setRawInput(entry.query)}
                      className="text-foreground data-[selected=true]:bg-accent group flex items-center gap-2 rounded-md"
                    >
                      <FileText
                        className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                        aria-hidden
                      />
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
                        <Pin className="text-muted-foreground h-3 w-3" />
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
                  <span className="kicker text-muted-foreground flex items-center gap-2">
                    {t('results')}
                    {search.loading ? (
                      <span className="text-muted-foreground/60 text-[10px]">{t('searching')}</span>
                    ) : null}
                  </span>
                }
              >
                {search.results.map((result) => {
                  const Icon = RESULT_ICON[result.type] ?? Search;
                  return (
                    <CommandItem
                      key={`${result.type}:${result.id}`}
                      value={`result:${result.type}:${result.id}:${result.title}:${result.badge ?? ''}`}
                      onSelect={() => navigate(result.href ?? '#')}
                      className="text-foreground data-[selected=true]:bg-accent flex items-center gap-2 rounded-md"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          {result.badge ? (
                            <span className="border-border bg-muted text-muted-foreground shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] leading-none">
                              {result.badge}
                            </span>
                          ) : null}
                          <span className="truncate text-sm">{result.title}</span>
                        </div>
                        {result.subtitle || result.meta ? (
                          <span className="text-muted-foreground truncate text-[11px]">
                            {result.subtitle ?? result.meta}
                          </span>
                        ) : null}
                      </div>
                      {result.meta && result.subtitle ? (
                        <span className="text-muted-foreground hidden max-w-[140px] truncate text-[10px] sm:inline">
                          {result.meta}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {/* ---- Quick navigation (always visible while empty) ---- */}
            {showRecents ? (
              <>
                <CommandSeparator className="bg-border" />
                <CommandGroup
                  heading={<span className="kicker text-muted-foreground">{t('navigate')}</span>}
                >
                  {visibleQuickNav.map((nav) => (
                    <CommandItem
                      key={nav.id}
                      value={nav.id}
                      onSelect={() => navigate(nav.href)}
                      className="text-foreground data-[selected=true]:bg-accent flex items-center gap-2 rounded-md"
                    >
                      <nav.icon
                        className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{navLabel(nav)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>

          {/* ---- Footer hint strip ---- */}
          <div className="border-border bg-muted text-muted-foreground flex items-center justify-between gap-3 border-t px-3 py-1.5 text-[10px]">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="border-border bg-muted rounded border px-1 font-mono">{'↑'}</kbd>{' '}
                <kbd className="border-border bg-muted rounded border px-1 font-mono">{'↓'}</kbd>{' '}
                {t('hintNavigate')}
              </span>
              <span>
                <kbd className="border-border bg-muted rounded border px-1 font-mono">{'⏎'}</kbd>{' '}
                {t('hintOpen')}
              </span>
              <span>
                <kbd className="border-border bg-muted rounded border px-1 font-mono">{'tab'}</kbd>{' '}
                {t('hintCycleTabs')}
              </span>
            </div>
            <span>{'FEAT-25 omnibar'}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
