'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settingsConfig');
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
      const response = await fetch(`/api/organizations/${organizationId}/ai-agents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || t('aiQuickSetup.enable_failed'));
      }
      return response.json() as Promise<WorkspaceAgentsResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-agent-settings', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['ai-capability'] });
      setApiKey('');
      toast({
        title: t('aiQuickSetup.enabled_toast_title'),
        description: t('aiQuickSetup.enabled_toast_desc', { provider: PROVIDER_LABELS[provider] }),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t('aiQuickSetup.enable_failed'),
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
      return t('aiQuickSetup.key_hint_workspace');
    }
    if (providerConfigured && providerSource === 'platform') {
      return t('aiQuickSetup.key_hint_platform');
    }
    if (providerConfigured && providerSource === 'server_env') {
      return t('aiQuickSetup.key_hint_server_env');
    }
    return t('aiQuickSetup.key_hint_none', { provider: PROVIDER_LABELS[provider] });
  })();

  const submitDisabled =
    !canManage ||
    mutation.isPending ||
    (provider !== 'native' && !providerConfigured && !apiKey.trim());

  return (
    <div className="border-primary/30 bg-primary/[0.03] space-y-4 rounded-lg border p-5">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <Wand2 className="h-4 w-4" />
        </span>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('aiQuickSetup.title')}</h3>
            {assistantAlreadyOn && (
              <span className="bg-accent-emerald/10 text-accent-emerald inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                <CheckCircle2 className="h-3 w-3" />
                {t('aiQuickSetup.active')}
              </span>
            )}
          </div>
          <p className="text-muted-foreground max-w-prose text-xs">{t('aiQuickSetup.intro')}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('aiQuickSetup.provider_label')}</Label>
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
              <SelectItem value="native">{t('aiQuickSetup.provider_native')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('aiQuickSetup.model_label')}</Label>
            {onManageProfiles && (
              <button
                type="button"
                onClick={onManageProfiles}
                className="text-primary text-[11px] hover:underline"
              >
                {t('aiQuickSetup.manage_profiles')}
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
                <SelectValue placeholder={t('aiQuickSetup.select_model')} />
              </SelectTrigger>
              <SelectContent>
                {savedProfiles.filter((p) => p.provider === provider).length > 0 && (
                  <>
                    <div className="text-muted-foreground px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                      {t('aiQuickSetup.your_saved_profiles')}
                    </div>
                    {savedProfiles
                      .filter((p) => p.provider === provider)
                      .map((profile) => (
                        <SelectItem key={`profile:${profile.id}`} value={profile.model}>
                          {profile.name} · {profile.model}
                        </SelectItem>
                      ))}
                    <div className="border-border/60 my-1 border-t" />
                    <div className="text-muted-foreground px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                      {provider === 'openai'
                        ? t('aiQuickSetup.openai_catalog')
                        : t('aiQuickSetup.anthropic_catalog')}
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
              placeholder={
                provider === 'native'
                  ? 'tasknebula-planner-v1'
                  : t('aiQuickSetup.model_id_placeholder')
              }
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
            {assistantAlreadyOn ? t('aiQuickSetup.update') : t('aiQuickSetup.enable_button')}
          </Button>
        </div>
      </div>

      {provider !== 'native' && (
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="quick-api-key">
            {t('aiQuickSetup.api_key_label')}
          </Label>
          <Input
            id="quick-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              providerConfigured
                ? t('aiQuickSetup.api_key_keep_placeholder')
                : PROVIDER_PLACEHOLDERS[provider]
            }
            autoComplete="off"
            disabled={!canManage || mutation.isPending}
          />
          {keyHint && <p className="text-muted-foreground text-[11px]">{keyHint}</p>}
        </div>
      )}
    </div>
  );
}
