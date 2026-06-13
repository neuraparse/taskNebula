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
import { useTranslations } from 'next-intl';
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
import { Check, Cog, Loader2, Plug, Trash2 } from 'lucide-react';

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
  { label: string; scopeHint?: string; redirectHint?: string }
> = {
  slack: {
    label: 'Slack',
    scopeHint: 'channels:read,chat:write',
    redirectHint: 'https://your-domain/api/integrations/slack/callback',
  },
  gitlab: {
    label: 'GitLab',
    scopeHint: 'read_api read_repository',
    redirectHint: 'https://your-domain/api/integrations/gitlab/callback',
  },
  jira: {
    label: 'Jira (Atlassian)',
    scopeHint: 'read:jira-user read:jira-work write:jira-work offline_access',
    redirectHint: 'https://your-domain/api/integrations/jira/callback',
  },
  github: {
    label: 'GitHub',
    scopeHint: 'repo read:user',
    redirectHint: 'https://your-domain/api/integrations/github/callback',
  },
  google: {
    label: 'Google',
    redirectHint: 'https://your-domain/api/auth/callback/google',
  },
  sentry: {
    label: 'Sentry',
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
  const response = await fetch(`/api/admin/integrations?provider=${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to remove credentials');
  }
  return response.json();
}

export function IntegrationsAdminPanel() {
  const t = useTranslations('adminPanels');
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
      toast({ title: t('integrations.credentialsRemoved') });
    },
    onError: (err: Error) => {
      toast({
        title: t('integrations.removeFailed'),
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
          <Plug className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-semibold">{t('integrations.title')}</h3>
        </div>
        <p className="text-muted-foreground max-w-prose text-xs">
          {t.rich('integrations.description', {
            code: (chunks) => <code className="font-mono">{chunks}</code>,
          })}
        </p>
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 px-6 py-8 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('integrations.loading')}
          </div>
        ) : error ? (
          <div className="text-destructive px-6 py-6 text-sm">
            {error instanceof Error ? error.message : t('integrations.loadError')}
          </div>
        ) : (
          <ul className="divide-border/50 divide-y">
            {providers.map((provider) => (
              <ProviderRow
                key={provider.provider}
                provider={provider}
                onConfigure={() => setEditing(provider.provider)}
                onRemove={() => deleteMutation.mutate(provider.provider)}
                removing={
                  deleteMutation.isPending && deleteMutation.variables === provider.provider
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
  const t = useTranslations('adminPanels');
  const meta = PROVIDER_META[provider.provider];
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{meta.label}</span>
          {provider.configured ? (
            <span className="chip-emerald inline-flex items-center gap-1 text-[11px]">
              <Check className="h-3 w-3" />
              {provider.source === 'env'
                ? t('integrations.configuredEnv')
                : t('integrations.configured')}
            </span>
          ) : (
            <span className="chip text-muted-foreground text-[11px]">
              {t('integrations.notConfigured')}
            </span>
          )}
          {provider.clientIdPreview ? (
            <span className="chip font-mono text-[11px]">{provider.clientIdPreview}</span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t(`integrations.providerDescription.${provider.provider}`)}
        </p>
        <dl className="text-muted-foreground mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="inline font-medium">{t('integrations.redirectUriLabel')} </dt>
            <dd className="inline break-all font-mono">
              {provider.redirectUri ?? <em>{t('integrations.default')}</em>}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="inline font-medium">{t('integrations.scopeLabel')} </dt>
            <dd className="inline break-words font-mono">
              {provider.scope ?? <em>{t('integrations.default')}</em>}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onConfigure}>
          <Cog className="mr-1.5 h-3.5 w-3.5" />
          {provider.source === 'db' ? t('integrations.edit') : t('integrations.configure')}
        </Button>
        {provider.source === 'db' ? (
          <Button size="sm" variant="outline" onClick={onRemove} disabled={removing}>
            {removing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('integrations.remove')}
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
  const t = useTranslations('adminPanels');
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
        title: t('integrations.credentialsSaved'),
        description: t('integrations.credentialsSavedDescription', { provider: meta.label }),
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: t('integrations.saveFailed'),
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
          <DialogTitle>{t('integrations.configureProvider', { provider: meta.label })}</DialogTitle>
          <DialogDescription>
            {t('integrations.configureDescription', { provider: meta.label })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-client-id`}>
              {t('integrations.clientId')}
            </Label>
            <Input
              id={`integration-${provider}-client-id`}
              autoComplete="off"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={current?.clientIdPreview ?? t('integrations.clientId')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-client-secret`}>
              {t('integrations.clientSecret')}
            </Label>
            <Input
              id={`integration-${provider}-client-secret`}
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={
                current?.configured
                  ? t('integrations.leaveBlankToRotate')
                  : t('integrations.clientSecret')
              }
            />
            <p className="text-muted-foreground text-[11px]">{t('integrations.replaceRowHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`integration-${provider}-redirect`}>
              {t('integrations.redirectUri')}{' '}
              <span className="text-muted-foreground">{t('integrations.optional')}</span>
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
              {t('integrations.scope')}{' '}
              <span className="text-muted-foreground">{t('integrations.optional')}</span>
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
            {t('integrations.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t('integrations.saveCredentials')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
