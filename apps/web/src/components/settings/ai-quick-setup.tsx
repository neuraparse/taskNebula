'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, CheckCircle2, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AGENT_PROVIDER_DEFAULT_MODELS,
  type AgentProvider,
  type WorkspaceAgentSettings,
} from '@/lib/agents/config';
import { getModelCatalogForProvider } from '@/lib/agents/model-catalog';

type QuickProvider = Extract<AgentProvider, 'openai' | 'anthropic' | 'native'>;

type WorkspaceAgentsResponse = {
  workspaceSettings: WorkspaceAgentSettings;
  providerStatus: { configured: boolean; source: string | null };
};

type SavedProfile = {
  id: string;
  name: string;
  provider: string;
  model: string;
};

interface AiQuickSetupProps {
  organizationId: string;
  workspaceSettings: WorkspaceAgentSettings;
  providerConfigured: boolean;
  providerSource: 'workspace' | 'platform' | 'server_env' | null;
  canManage: boolean;
  savedProfiles?: SavedProfile[];
  onManageProfiles?: () => void;
}

const PROVIDER_LABELS: Record<QuickProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  native: 'TaskNebula native (no LLM)',
};

const PROVIDER_PLACEHOLDERS: Record<QuickProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  native: '',
};

export function AiQuickSetup({
  organizationId,
  workspaceSettings,
  providerConfigured,
  providerSource,
  canManage,
  savedProfiles = [],
  onManageProfiles,
}: AiQuickSetupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startingProvider: QuickProvider =
    workspaceSettings.provider === 'anthropic' ||
    workspaceSettings.provider === 'openai' ||
    workspaceSettings.provider === 'native'
      ? workspaceSettings.provider
      : 'openai';

  const [provider, setProvider] = useState<QuickProvider>(startingProvider);
  const [model, setModel] = useState<string>(
    workspaceSettings.model || AGENT_PROVIDER_DEFAULT_MODELS[startingProvider]
  );
  const [apiKey, setApiKey] = useState('');

  const catalog = useMemo(() => getModelCatalogForProvider(provider), [provider]);

  const assistantAlreadyOn =
    workspaceSettings.assistantEnabled === true &&
    workspaceSettings.provider === provider &&
    providerConfigured;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        assistantEnabled: true,
        provider,
        model: model.trim() || AGENT_PROVIDER_DEFAULT_MODELS[provider],
      };
      if (provider !== 'native' && apiKey.trim()) {
        payload.credential = { provider, apiKey: apiKey.trim() };
      }
      const response = await fetch(
        `/api/organizations/${organizationId}/ai-agents`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Failed to enable AI Assistant');
      }
      return response.json() as Promise<WorkspaceAgentsResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-agent-settings', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['ai-capability'] });
      setApiKey('');
      toast({
        title: 'AI Assistant enabled',
        description: `Draft-with-AI is live for this workspace using ${PROVIDER_LABELS[provider]}.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Could not enable AI Assistant',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  function handleProviderChange(next: QuickProvider) {
    setProvider(next);
    // Auto-fill a sensible model when switching providers so users don't
    // have to hunt for a valid identifier.
    setModel(AGENT_PROVIDER_DEFAULT_MODELS[next]);
  }

  const keyHint = (() => {
    if (provider === 'native') return null;
    if (providerConfigured && providerSource === 'workspace') {
      return 'A workspace key is already stored. Leave blank to keep it.';
    }
    if (providerConfigured && providerSource === 'platform') {
      return 'Platform default key is available. Enter a workspace key only to override it.';
    }
    if (providerConfigured && providerSource === 'server_env') {
      return 'Server env key detected. Enter a workspace key only to override it.';
    }
    return `No ${PROVIDER_LABELS[provider]} key configured yet — paste one below to activate.`;
  })();

  const submitDisabled =
    !canManage ||
    mutation.isPending ||
    (provider !== 'native' && !providerConfigured && !apiKey.trim());

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wand2 className="h-4 w-4" />
        </span>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Quick setup — enable AI Assistant</h3>
            {assistantAlreadyOn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-emerald/10 px-2 py-0.5 text-[11px] font-medium text-accent-emerald">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-prose">
            Pick a provider, we&apos;ll auto-fill a sensible model. Paste your API key (or leave
            blank to use the platform default). One click — done. You can fine-tune below.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Provider</Label>
          <Select
            value={provider}
            onValueChange={(v) => handleProviderChange(v as QuickProvider)}
            disabled={!canManage || mutation.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              <SelectItem value="native">TaskNebula native (no LLM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Model</Label>
            {onManageProfiles && (
              <button
                type="button"
                onClick={onManageProfiles}
                className="text-[11px] text-primary hover:underline"
              >
                Manage saved profiles
              </button>
            )}
          </div>
          {catalog.length > 0 ? (
            <Select
              value={model}
              onValueChange={setModel}
              disabled={!canManage || mutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {savedProfiles.filter((p) => p.provider === provider).length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Your saved profiles
                    </div>
                    {savedProfiles
                      .filter((p) => p.provider === provider)
                      .map((profile) => (
                        <SelectItem key={`profile:${profile.id}`} value={profile.model}>
                          {profile.name} · {profile.model}
                        </SelectItem>
                      ))}
                    <div className="my-1 border-t border-border/60" />
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {provider === 'openai' ? 'OpenAI catalog' : 'Anthropic catalog'}
                    </div>
                  </>
                )}
                {catalog.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'native' ? 'tasknebula-planner-v1' : 'model id'}
              disabled={!canManage || mutation.isPending}
            />
          )}
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={submitDisabled}
            className="h-10 w-full md:w-auto"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {assistantAlreadyOn ? 'Update' : 'Enable AI Assistant'}
          </Button>
        </div>
      </div>

      {provider !== 'native' && (
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="quick-api-key">
            API key
          </Label>
          <Input
            id="quick-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              providerConfigured
                ? 'Leave blank to keep the existing key'
                : PROVIDER_PLACEHOLDERS[provider]
            }
            autoComplete="off"
            disabled={!canManage || mutation.isPending}
          />
          {keyHint && (
            <p className="text-[11px] text-muted-foreground">{keyHint}</p>
          )}
        </div>
      )}
    </div>
  );
}
