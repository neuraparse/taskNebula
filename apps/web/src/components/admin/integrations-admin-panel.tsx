'use client';

/**
 * Admin panel for platform-level Integration OAuth client credentials.
 *
 * Super-admins manage the per-provider (slack, gitlab, jira, github, google)
 * client id / client secret / redirect uri / scope here instead of setting
 * env vars. Values are encrypted at rest and the plaintext is never returned
 * to the browser after the initial write.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  Cog,
  Loader2,
  Plug,
  Trash2,
} from 'lucide-react';

type Provider = 'slack' | 'gitlab' | 'jira' | 'github' | 'google' | 'sentry';

type ProviderSummary = {
  provider: Provider;
  configured: boolean;
  source: 'db' | 'env' | null;
  clientIdPreview: string | null;
  redirectUri: string | null;
  scope: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

type ListResponse = {
  providers: ProviderSummary[];
};

const PROVIDER_META: Record<
  Provider,
  { label: string; description: string; scopeHint?: string; redirectHint?: string }
> = {
  slack: {
    label: 'Slack',
    description:
      'OAuth app credentials for connecting Slack workspaces to TaskNebula.',
    scopeHint: 'channels:read,chat:write',
    redirectHint: 'https://your-domain/api/integrations/slack/callback',
  },
  gitlab: {
    label: 'GitLab',
    description: 'OAuth application for mirroring merge requests and pipelines.',
    scopeHint: 'read_api read_repository',
    redirectHint: 'https://your-domain/api/integrations/gitlab/callback',
  },
  jira: {
    label: 'Jira (Atlassian)',
    description: 'Atlassian 3LO app for syncing issues and projects.',
    scopeHint: 'read:jira-user read:jira-work write:jira-work offline_access',
    redirectHint: 'https://your-domain/api/integrations/jira/callback',
  },
  github: {
    label: 'GitHub',
    description:
      'GitHub OAuth app for sign-in and repo / issue / pull request sync.',
    scopeHint: 'repo read:user',
    redirectHint: 'https://your-domain/api/integrations/github/callback',
  },
  google: {
    label: 'Google',
    description: 'Google OAuth client for sign-in and workspace integrations.',
    redirectHint: 'https://your-domain/api/auth/callback/google',
  },
  sentry: {
    label: 'Sentry',
    description: 'OAuth app for syncing Sentry issues with TaskNebula work items.',
    scopeHint: 'org:read project:read event:read',
    redirectHint: 'https://your-domain/api/integrations/sentry/callback',
  },
};

async function fetchProviders(): Promise<ListResponse> {
  const response = await fetch('/api/admin/integrations');
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to load integration credentials');
  }
  return response.json();
}

async function saveProvider(input: {
  provider: Provider;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scope?: string;
}): Promise<ListResponse> {
  const response = await fetch('/api/admin/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to save credentials');
  }
  return response.json();
}

async function deleteProvider(provider: Provider): Promise<ListResponse> {
  const response = await fetch(
    `/api/admin/integrations?provider=${encodeURIComponent(provider)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to remove credentials');
  }
  return response.json();
}

export function IntegrationsAdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Provider | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: fetchProviders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: Provider) => deleteProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: 'Credentials removed' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Remove failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const providers = data?.providers ?? [];
  const activeProvider = useMemo(
    () => providers.find((p) => p.provider === editing) ?? null,
    [providers, editing]
  );

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-1 p-6">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Integration OAuth credentials</h3>
        </div>
        <p className="max-w-prose text-xs text-muted-foreground">
          Configure platform-wide client id / client secret for each integration
          provider. Values are encrypted (AES-256-GCM) at rest. Environment
          variables (e.g. <code className="font-mono">SLACK_CLIENT_ID</code>) still
          work as a fallback when a provider has no database entry.
        </p>
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 px-6 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading integrations…
          </div>
        ) : error ? (
          <div className="px-6 py-6 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load integrations'}
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {providers.map((provider) => (
              <ProviderRow
                key={provider.provider}
                provider={provider}
                onConfigure={() => setEditing(provider.provider)}
                onRemove={() => deleteMutation.mutate(provider.provider)}
                removing={
                  deleteMutation.isPending &&
                  deleteMutation.variables === provider.provider
                }
              />
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <ConfigureDialog
          provider={editing}
          current={activeProvider}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ProviderRow({
  provider,
  onConfigure,
  onRemove,
  removing,
}: {
  provider: ProviderSummary;
  onConfigure: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const meta = PROVIDER_META[provider.provider];
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{meta.label}</span>
          {provider.configured ? (
            <span className="chip-emerald inline-flex items-center gap-1 text-[11px]">
              <Check className="h-3 w-3" />
              Configured
              {provider.source === 'env' ? ' (env)' : ''}
            </span>
          ) : (
            <span className="chip text-[11px] text-muted-foreground">
              Not configured
            </span>
          )}
          {provider.clientIdPreview ? (
            <span className="chip font-mono text-[11px]">
              {provider.clientIdPreview}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
        <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="inline font-medium">Redirect URI: </dt>
            <dd className="inline break-all font-mono">
              {provider.redirectUri ?? <em>default</em>}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="inline font-medium">Scope: </dt>
            <dd className="inline break-words font-mono">
              {provider.scope ?? <em>default</em>}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onConfigure}>
          <Cog className="mr-1.5 h-3.5 w-3.5" />
          {provider.source === 'db' ? 'Edit' : 'Configure'}
        </Button>
        {provider.source === 'db' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onRemove}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Remove
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function ConfigureDialog({
  provider,
  current,
  open,
  onOpenChange,
}: {
  provider: Provider;
  current: ProviderSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const meta = PROVIDER_META[provider];

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(current?.redirectUri ?? '');
  const [scope, setScope] = useState(current?.scope ?? '');

  const saveMutation = useMutation({
    mutationFn: saveProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: 'Credentials saved',
        description: `${meta.label} OAuth is now configured from the admin store.`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: 'Save failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const canSubmit = clientId.trim().length > 0 && clientSecret.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    saveMutation.mutate({
      provider,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim() ? redirectUri.trim() : undefined,
      scope: scope.trim() ? scope.trim() : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure {meta.label}</DialogTitle>
          <DialogDescription>
            Paste the OAuth client id and secret from your {meta.label} app.
            Secrets are encrypted before leaving the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-client-id`}>Client ID</Label>
            <Input
              id={`integration-${provider}-client-id`}
              autoComplete="off"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={current?.clientIdPreview ?? 'Client ID'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-client-secret`}>
              Client secret
            </Label>
            <Input
              id={`integration-${provider}-client-secret`}
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={current?.configured ? 'Leave blank to rotate' : 'Client secret'}
            />
            <p className="text-[11px] text-muted-foreground">
              Replacing the row requires re-entering the secret.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-redirect`}>
              Redirect URI <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`integration-${provider}-redirect`}
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder={meta.redirectHint}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-scope`}>
              Scope <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`integration-${provider}-scope`}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder={meta.scopeHint}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
