'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, Trash2, Check } from 'lucide-react';

type ProviderKey = 'openai' | 'anthropic';

type PlatformCredential = {
  preview: string;
  updatedAt: string;
  updatedBy: string;
} | null;

type CredentialsResponse = {
  credentials: Record<ProviderKey, PlatformCredential>;
};

const PROVIDER_LABELS: Record<ProviderKey, { label: string }> = {
  openai: { label: 'OpenAI' },
  anthropic: { label: 'Anthropic' },
};

async function fetchCredentials(): Promise<CredentialsResponse> {
  const response = await fetch('/api/admin/agent-control/credentials');
  if (!response.ok) throw new Error('Failed to load platform credentials');
  return response.json();
}

async function upsertCredential(
  provider: ProviderKey,
  apiKey: string
): Promise<CredentialsResponse> {
  const response = await fetch('/api/admin/agent-control/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to save credential');
  }
  return response.json();
}

async function deleteCredential(provider: ProviderKey): Promise<CredentialsResponse> {
  const response = await fetch('/api/admin/agent-control/credentials', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to remove credential');
  }
  return response.json();
}

export function PlatformAiCredentials() {
  const t = useTranslations('adminPanels');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agent-control', 'credentials'],
    queryFn: fetchCredentials,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const upsertMutation = useMutation({
    mutationFn: ({ provider, apiKey }: { provider: ProviderKey; apiKey: string }) =>
      upsertCredential(provider, apiKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agent-control', 'credentials'] });
      toast({
        title: t('platformAi.keySaved'),
        description: t('platformAi.keySavedDescription', {
          provider: PROVIDER_LABELS[variables.provider].label,
        }),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t('platformAi.saveFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: ProviderKey) => deleteCredential(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agent-control', 'credentials'] });
      toast({ title: t('platformAi.keyRemoved') });
    },
    onError: (err: Error) => {
      toast({
        title: t('platformAi.removeFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="surface-card space-y-4 p-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <KeyRound className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-semibold">{t('platformAi.title')}</h3>
        </div>
        <p className="text-muted-foreground max-w-prose text-xs">{t('platformAi.description')}</p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('platformAi.loadingKeys')}
        </div>
      ) : (
        <div className="space-y-4">
          {(['openai', 'anthropic'] as const).map((provider) => (
            <CredentialRow
              key={provider}
              provider={provider}
              stored={data?.credentials[provider] ?? null}
              isSaving={upsertMutation.isPending && upsertMutation.variables?.provider === provider}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === provider}
              onSave={(apiKey) => upsertMutation.mutate({ provider, apiKey })}
              onDelete={() => deleteMutation.mutate(provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  provider,
  stored,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
}: {
  provider: ProviderKey;
  stored: PlatformCredential;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: (apiKey: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('adminPanels');
  const { label } = PROVIDER_LABELS[provider];
  const hint = t(`platformAi.hint.${provider}`);
  const [value, setValue] = useState('');

  return (
    <div className="border-border bg-background/50 space-y-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        {stored ? (
          <span className="chip text-[11px]">
            <Check className="h-3 w-3" />
            {stored.preview}
          </span>
        ) : (
          <span className="chip text-muted-foreground text-[11px]">
            {t('platformAi.notConfigured')}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs" htmlFor={`platform-${provider}-key`}>
          {stored ? t('platformAi.replaceKey') : t('platformAi.apiKey')}
        </Label>
        <Input
          id={`platform-${provider}-key`}
          type="password"
          autoComplete="off"
          placeholder={provider === 'openai' ? 'sk-…' : 'sk-ant-…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSaving || isDeleting}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (value.trim().length < 20) return;
            onSave(value.trim());
            setValue('');
          }}
          disabled={value.trim().length < 20 || isSaving}
        >
          {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {stored ? t('platformAi.rotate') : t('platformAi.save')}
        </Button>
        {stored && (
          <Button size="sm" variant="outline" onClick={() => onDelete()} disabled={isDeleting}>
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('platformAi.remove')}
          </Button>
        )}
        {stored?.updatedAt && (
          <span className="text-muted-foreground ml-auto text-[11px]">
            {t('platformAi.updated', { date: new Date(stored.updatedAt).toLocaleDateString() })}
          </span>
        )}
      </div>
    </div>
  );
}
