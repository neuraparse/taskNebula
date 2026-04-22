'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOrganization } from '@/lib/hooks/use-organization';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationCategory =
  | 'source-control'
  | 'communication'
  | 'monitoring'
  | 'ai'
  | 'productivity'
  | 'design';

export type IntegrationStatus = 'available' | 'connected' | 'coming_soon';

export interface IntegrationDefinition {
  id: string;
  name: string;
  description: string;
  status?: IntegrationStatus;
  href?: string;
  category: IntegrationCategory;
  brandColor: string; // hex
  Icon: React.ComponentType<{ className?: string }>;
}

// ---------------------------------------------------------------------------
// Inline brand glyph helper
// ---------------------------------------------------------------------------

function makeLetterGlyph(letter: string, color: string) {
  function Glyph({ className }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
      >
        <rect x="2" y="2" width="20" height="20" rx="5" fill={color} />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="12"
          fontWeight="700"
          fill="#fff"
        >
          {letter}
        </text>
      </svg>
    );
  }
  Glyph.displayName = `BrandGlyph(${letter})`;
  return Glyph;
}

// Hand-tuned simple SVG marks for a few brands; everything else falls back
// to a colored letter tile. Recognizable, no external dependencies.

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        fill="#181717"
        d="M12 1.5A10.5 10.5 0 0 0 1.5 12c0 4.64 3.01 8.57 7.19 9.96.53.1.72-.23.72-.51v-1.78c-2.93.64-3.55-1.41-3.55-1.41-.48-1.21-1.16-1.54-1.16-1.54-.95-.65.07-.64.07-.64 1.05.07 1.6 1.08 1.6 1.08.93 1.6 2.45 1.14 3.05.87.09-.68.36-1.14.66-1.4-2.34-.27-4.8-1.17-4.8-5.21 0-1.15.41-2.09 1.08-2.83-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.88 1.08a9.93 9.93 0 0 1 5.24 0c2-1.36 2.88-1.08 2.88-1.08.57 1.45.21 2.52.1 2.79.67.74 1.08 1.68 1.08 2.83 0 4.05-2.47 4.94-4.82 5.2.37.32.7.95.7 1.92v2.84c0 .28.19.61.73.51A10.5 10.5 0 0 0 22.5 12 10.5 10.5 0 0 0 12 1.5Z"
      />
    </svg>
  );
}

function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path fill="#FC6D26" d="m12 21.5-3.7-11.4h7.4L12 21.5Z" />
      <path fill="#E24329" d="m12 21.5-3.7-11.4H3.1L12 21.5Z" />
      <path fill="#FCA326" d="M3.1 10.1 2 13.5a.8.8 0 0 0 .3.9L12 21.5 3.1 10.1Z" />
      <path fill="#E24329" d="M3.1 10.1h5.2L6 3a.4.4 0 0 0-.7 0l-2.2 7.1Z" />
      <path fill="#FC6D26" d="m12 21.5 3.7-11.4h5.2L12 21.5Z" />
      <path fill="#FCA326" d="m20.9 10.1 1.1 3.4a.8.8 0 0 1-.3.9L12 21.5l8.9-11.4Z" />
      <path fill="#E24329" d="M20.9 10.1h-5.2L18 3a.4.4 0 0 1 .7 0l2.2 7.1Z" />
    </svg>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path fill="#36C5F0" d="M6.5 14.5a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Z" />
      <path fill="#2EB67D" d="M9.5 6.5a2 2 0 1 1 2-2v2h-2Zm0 1a2 2 0 1 1 0 4h-5a2 2 0 1 1 0-4h5Z" />
      <path fill="#ECB22E" d="M17.5 9.5a2 2 0 1 1 2 2h-2v-2Zm-1 0a2 2 0 1 1-4 0v-5a2 2 0 1 1 4 0v5Z" />
      <path fill="#E01E5A" d="M14.5 17.5a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z" />
    </svg>
  );
}

function SentryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        fill="#362D59"
        d="M12 3.2c-.5 0-1 .27-1.27.74L2.95 17.4a1.45 1.45 0 0 0 1.25 2.18h3.4a8.5 8.5 0 0 0-5.13-7.34l1.4-2.43A11.3 11.3 0 0 1 10.5 19.6h2.6a13.9 13.9 0 0 0-7.86-12.14l1.4-2.42a16.5 16.5 0 0 1 9.1 14.56h4.06c.99 0 1.62-1.06 1.13-1.92L13.27 3.94A1.46 1.46 0 0 0 12 3.2Z"
      />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#D97757" />
      <path
        d="M8.4 16.4 11 7.6h2l2.6 8.8h-1.7l-.6-2.1h-2.6l-.6 2.1H8.4Zm2.7-3.5h1.8L12 9.7l-.9 3.2Z"
        fill="#fff"
      />
    </svg>
  );
}

function JiraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        fill="#2684FF"
        d="M11.5 2.5h9.7c0 2.4-1.9 4.3-4.3 4.3h-1.9v1.8a4.3 4.3 0 0 1-4.3 4.3V3.4c0-.5.4-.9.8-.9Z"
      />
      <path
        fill="#2684FF"
        opacity=".7"
        d="M6.7 7.3h9.7c0 2.4-1.9 4.3-4.3 4.3H10.2v1.9a4.3 4.3 0 0 1-4.3 4.2V8.2c0-.5.4-.9.8-.9Z"
      />
      <path
        fill="#2684FF"
        opacity=".4"
        d="M2 12.1h9.7c0 2.4-1.9 4.3-4.3 4.3H5.5v1.9A4.3 4.3 0 0 1 1.2 22.5V13a.9.9 0 0 1 .8-.9Z"
      />
    </svg>
  );
}

function VSCodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path
        fill="#0078D4"
        d="m17.5 2.4-9.7 9.1L4 8.6 2 9.7v4.6l2 1.1 3.8-2.9 9.7 9.1L22 20V4l-4.5-1.6Zm0 5.7v7.8l-5-3.9 5-3.9Z"
      />
    </svg>
  );
}

function RaycastIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#FF6363" />
      <path
        fill="#fff"
        d="m6 12 6-6 6 6-1.4 1.4L12 8.8l-4.6 4.6L6 12Zm0 4 6-6 6 6-1.4 1.4L12 12.8l-4.6 4.6L6 16Z"
      />
    </svg>
  );
}

function DrawioIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#F08705" />
      <path
        fill="#fff"
        d="M7 7h4v3H7V7Zm6 7h4v3h-4v-3Zm-2-2 1.5 0v2H11v-2Zm-3-1H7v3h1v-3Zm9-3h-1v3h1V8Z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const githubAvailable: IntegrationStatus =
  typeof process !== 'undefined' && process.env.GITHUB_OAUTH ? 'available' : 'coming_soon';

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync issues, PRs, and commits',
    status: githubAvailable,
    href: githubAvailable === 'available' ? '/settings/integrations/github' : undefined,
    category: 'source-control',
    brandColor: '#181717',
    Icon: GitHubIcon,
  },
  {
    // Status is resolved at runtime via /api/integrations/gitlab/status.
    // The initial 'available' value is a placeholder for the non-hook case
    // (e.g. if this registry is consumed outside the IntegrationsGrid).
    id: 'gitlab',
    name: 'GitLab',
    description: 'Sync issues, merge requests, and commits',
    status: 'available',
    category: 'source-control',
    brandColor: '#FC6D26',
    Icon: GitLabIcon,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Turn conversations into trackable work',
    status: 'coming_soon',
    category: 'communication',
    brandColor: '#4A154B',
    Icon: SlackIcon,
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Sync Sentry issues with work items',
    status: 'coming_soon',
    category: 'monitoring',
    brandColor: '#362D59',
    Icon: SentryIcon,
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'AI agents powered by TaskNebula MCP',
    status: 'available',
    href: '/settings?tab=ai',
    category: 'ai',
    brandColor: '#D97757',
    Icon: ClaudeIcon,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Migrate projects and issues to TaskNebula',
    status: 'coming_soon',
    category: 'productivity',
    brandColor: '#2684FF',
    Icon: JiraIcon,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    description: 'Manage TaskNebula from inside VS Code',
    status: 'coming_soon',
    category: 'productivity',
    brandColor: '#0078D4',
    Icon: VSCodeIcon,
  },
  {
    id: 'raycast',
    name: 'Raycast',
    description: 'Manage TaskNebula from anywhere on macOS',
    status: 'coming_soon',
    category: 'productivity',
    brandColor: '#FF6363',
    Icon: RaycastIcon,
  },
  {
    id: 'drawio',
    name: 'Draw.io',
    description: 'Diagrams and whiteboards inside Pages',
    status: 'coming_soon',
    category: 'design',
    brandColor: '#F08705',
    Icon: DrawioIcon,
  },
];

// Backstop in case someone wants to extend the registry without crafting a
// new SVG mark — exported so callers can build tiles consistently.
export { makeLetterGlyph };

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

const CATEGORY_FILTERS: { value: IntegrationCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'source-control', label: 'Source control' },
  { value: 'communication', label: 'Communication' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'ai', label: 'AI' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'design', label: 'Design' },
];

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface IntegrationCardProps {
  integration: IntegrationDefinition;
  footer?: React.ReactNode;
  accountLabel?: string | null;
}

function IntegrationCard({ integration, footer, accountLabel }: IntegrationCardProps) {
  if (integration.id === 'gitlab') {
    return <GitLabIntegrationCard integration={integration} />;
  }

  const { name, description, status, href, Icon } = integration;
  const isInteractive = href && status !== 'coming_soon' && !footer;

  const card = (
    <article
      className={cn(
        'group relative rounded-xl border border-border bg-card p-5 transition-all',
        isInteractive && 'hover:border-foreground/20 hover:shadow-sm'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted/50">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-tight">{name}</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug">{description}</p>
          {accountLabel && (
            <p className="mt-1 truncate text-[11.5px] font-medium text-foreground/80">
              {accountLabel}
            </p>
          )}
        </div>
      </div>
      {status === 'connected' && (
        <Badge variant="success" className="absolute right-4 top-4">
          Connected
        </Badge>
      )}
      {status === 'coming_soon' && (
        <Badge variant="muted" className="absolute right-4 top-4">
          Coming soon
        </Badge>
      )}
      {footer && <div className="mt-4 flex items-center gap-2">{footer}</div>}
    </article>
  );

  if (isInteractive && href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
      >
        {card}
      </Link>
    );
  }
  return card;
}

// ---------------------------------------------------------------------------
// Slack connection state hook — powers Connect / Disconnect buttons.
// ---------------------------------------------------------------------------

type SlackStatus = {
  connected: boolean;
  connection?: {
    id: string;
    externalAccountId: string | null;
    externalAccountLabel: string | null;
    scope: string | null;
    connectedById: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
};

function useSlackConnection(organizationId: string | null) {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/slack/status?organizationId=${encodeURIComponent(organizationId)}`,
        { credentials: 'same-origin' }
      );
      if (!res.ok) {
        setStatus({ connected: false });
        return;
      }
      const data = (await res.json()) as SlackStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = useCallback(async () => {
    if (!organizationId) return;
    setDisconnecting(true);
    try {
      await fetch(
        `/api/integrations/slack?organizationId=${encodeURIComponent(organizationId)}`,
        { method: 'DELETE', credentials: 'same-origin' }
      );
      await load();
    } finally {
      setDisconnecting(false);
    }
  }, [organizationId, load]);

  return { status, loading, disconnecting, disconnect, refresh: load };
}

// ---------------------------------------------------------------------------
// GitLab card — OAuth connect / disconnect wired against
// /api/integrations/gitlab/(authorize|callback|status) + DELETE /api/integrations/gitlab.
// ---------------------------------------------------------------------------

interface GitLabStatusResponse {
  connected: boolean;
  connection?: {
    externalAccountLabel?: string | null;
  };
}

function GitLabIntegrationCard({ integration }: IntegrationCardProps) {
  const { name, description, Icon } = integration;
  const currentOrganizationId = useOrganization((state) => state.currentOrganizationId);

  const [connected, setConnected] = useState(false);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentOrganizationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/gitlab/status?organizationId=${encodeURIComponent(currentOrganizationId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as GitLabStatusResponse;
      setConnected(Boolean(json.connected));
      setAccountLabel(json.connection?.externalAccountLabel ?? null);
    } catch (err) {
      console.error('GitLab status check failed', err);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = () => {
    if (!currentOrganizationId) {
      setError('Select an organization first');
      return;
    }
    window.location.href = `/api/integrations/gitlab/authorize?organizationId=${encodeURIComponent(currentOrganizationId)}`;
  };

  const handleDisconnect = async () => {
    if (!currentOrganizationId) return;
    const ok = window.confirm('Disconnect GitLab from this workspace? TaskNebula will stop syncing issues and merge requests.');
    if (!ok) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/gitlab?organizationId=${encodeURIComponent(currentOrganizationId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`DELETE failed with ${res.status}`);
      setConnected(false);
      setAccountLabel(null);
    } catch (err) {
      console.error('GitLab disconnect failed', err);
      setError('Failed to disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <article className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted/50">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-tight">{name}</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug">{description}</p>
          {connected && accountLabel && (
            <p className="mt-1 text-[11.5px] text-muted-foreground">Account: {accountLabel}</p>
          )}
          {error && (
            <p className="mt-1 text-[11.5px] text-destructive">{error}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className={cn(
                  'rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium',
                  'hover:border-foreground/30 disabled:opacity-60'
                )}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={!currentOrganizationId || loading}
                className={cn(
                  'rounded-md border border-foreground bg-foreground px-2.5 py-1 text-xs font-medium text-background',
                  'hover:opacity-90 disabled:opacity-60'
                )}
              >
                {loading ? 'Checking...' : 'Connect'}
              </button>
            )}
          </div>
        </div>
      </div>
      {connected && (
        <Badge variant="success" className="absolute right-4 top-4">
          Connected
        </Badge>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main grid
// ---------------------------------------------------------------------------

export interface IntegrationsGridProps {
  integrations?: IntegrationDefinition[];
}

export function IntegrationsGrid({ integrations = INTEGRATIONS }: IntegrationsGridProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | 'all'>('all');
  const currentOrganizationId = useOrganization((s) => s.currentOrganizationId);
  const slack = useSlackConnection(currentOrganizationId);

  // When the user returns from Slack's OAuth redirect with `?connected=slack`,
  // strip the query param and refresh status so the card flips to "Connected".
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'slack') {
      params.delete('connected');
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
      window.history.replaceState({}, '', next);
      void slack.refresh();
    }
  }, [slack]);

  // Apply dynamic status/href to the Slack tile so the card reflects live state.
  const effectiveIntegrations = useMemo<IntegrationDefinition[]>(() => {
    return integrations.map((item) => {
      if (item.id !== 'slack') return item;
      const connected = slack.status?.connected === true;
      return {
        ...item,
        status: connected ? 'connected' : 'available',
        href: undefined,
      };
    });
  }, [integrations, slack.status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveIntegrations.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [effectiveIntegrations, search, activeCategory]);

  const renderCard = (integration: IntegrationDefinition) => {
    if (integration.id === 'slack') {
      const orgDisabled = !currentOrganizationId;
      const connected = slack.status?.connected === true;
      const label = slack.status?.connection?.externalAccountLabel || null;
      const connectHref = orgDisabled
        ? '#'
        : `/api/integrations/slack/authorize?organizationId=${encodeURIComponent(currentOrganizationId!)}`;

      const footer = connected ? (
        <button
          type="button"
          onClick={() => void slack.disconnect()}
          disabled={slack.disconnecting || orgDisabled}
          className={cn(
            'rounded-md border border-border px-3 py-1 text-xs font-medium',
            'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {slack.disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      ) : (
        <a
          href={connectHref}
          aria-disabled={orgDisabled}
          onClick={(e) => {
            if (orgDisabled) e.preventDefault();
          }}
          className={cn(
            'rounded-md border border-border bg-foreground px-3 py-1 text-xs font-medium text-background',
            'hover:opacity-90',
            orgDisabled && 'pointer-events-none opacity-50'
          )}
        >
          {slack.loading ? 'Checking…' : 'Connect'}
        </a>
      );

      return (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          footer={footer}
          accountLabel={connected ? label : null}
        />
      );
    }
    return <IntegrationCard key={integration.id} integration={integration} />;
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search integrations"
          aria-label="Search integrations"
          className={cn(
            'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by category">
        {CATEGORY_FILTERS.map((chip) => {
          const isActive = activeCategory === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveCategory(chip.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No integrations match that search</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different keyword or clear the category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((integration) => renderCard(integration))}
        </div>
      )}
    </div>
  );
}

export default IntegrationsGrid;
