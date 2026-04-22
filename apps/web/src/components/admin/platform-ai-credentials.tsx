'use client';

import { useState } from 'react';
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

const PROVIDER_LABELS: Record<ProviderKey, { label: string; hint: string }> = {
  openai: {
    label: 'OpenAI',
    hint: 'Used when a workspace has not entered its own OpenAI key. Starts with sk-…',
  },
  anthropic: {
    label: 'Anthropic',
    hint: 'Used when a workspace has not entered its own Anthropic key. Starts with sk-ant-…',
  },
};

async function fetchCredentials(): Promise<CredentialsResponse> {
  const response = await fetch('/api/admin/agent-control/credentials');
  if (!response.ok) throw new Error('Failed to load platform credentials');
  return response.json();
}

async function upsertCredential(provider: ProviderKey, apiKey: string): Promise<CredentialsResponse> {
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
        title: 'Platform key saved',
        description: `${PROVIDER_LABELS[variables.provider].label} default key is now available to all workspaces.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (provider: ProviderKey) => deleteCredential(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agent-control', 'credentials'] });
      toast({ title: 'Platform key removed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Remove failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="surface-card p-6 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Platform provider keys</h3>
        </div>
        <p className="text-xs text-muted-foreground max-w-prose">
          Optional defaults every workspace falls back to when it has not entered its own key.
          Stored encrypted (AES-256-GCM) in the DB — never shown in plaintext after save.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading keys…
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
  const { label, hint } = PROVIDER_LABELS[provider];
  const [value, setValue] = useState('');

  return (
    <div className="rounded-md border border-border bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {stored ? (
          <span className="chip text-[11px]">
            <Check className="h-3 w-3" />
            {stored.preview}
          </span>
        ) : (
          <span className="chip text-[11px] text-muted-foreground">Not configured</span>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs" htmlFor={`platform-${provider}-key`}>
          {stored ? 'Replace key' : 'API key'}
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
          {stored ? 'Rotate' : 'Save'}
        </Button>
        {stored && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Remove
          </Button>
        )}
        {stored?.updatedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Updated {new Date(stored.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
