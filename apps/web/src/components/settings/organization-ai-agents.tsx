'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useArchiveOrganizationAgentModelConfig,
  useCreateOrganizationAgentModelConfig,
  useOrganizationAgentSettings,
  useUpdateOrganizationAgentModelConfig,
  useUpdateOrganizationAgentSettings,
  type AgentModelConfig,
} from '@/lib/hooks/use-agents';
import {
  AGENT_CAPABILITY_DETAILS,
  getSuggestedModelForProvider,
  normalizeWorkspaceAgentSettings,
  type AgentProvider,
  type WorkspaceAgentSettings,
} from '@/lib/agents/config';
import {
  getModelCatalogEntry,
  getModelCatalogForProvider,
  getModelMaxOutputTokensLimit,
  getSupportedReasoningOptions,
  modelSupportsReasoning,
  modelSupportsTemperature,
  type AgentReasoningEffortOption,
} from '@/lib/agents/model-catalog';
import {
  Activity,
  Archive,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Loader2,
  PencilLine,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const EMPTY_SETTINGS: WorkspaceAgentSettings = {
  enabled: false,
  modelConfigId: null,
  provider: 'native',
  model: 'tasknebula-planner-v1',
  executionMode: 'assistive',
  allowWriteActions: false,
  requireApprovalForWrites: true,
  dailyRunLimit: 20,
  capabilities: {
    project_tracking: true,
    backlog_triage: true,
    sprint_planning: true,
    bulk_sprint_creation: true,
  },
};

type ModelConfigFormState = {
  name: string;
  provider: AgentProvider;
  presetModel: string;
  model: string;
  description: string;
  temperature: string;
  maxOutputTokens: string;
  reasoningEffort: AgentReasoningEffortOption;
  notes: string;
  isDefault: boolean;
  applyToWorkspace: boolean;
  workspaceApiKey: string;
};

const EMPTY_MODEL_CONFIG_FORM: ModelConfigFormState = {
  name: '',
  provider: 'openai',
  presetModel: 'gpt-5.4',
  model: 'gpt-5.4',
  description: '',
  temperature: '',
  maxOutputTokens: '',
  reasoningEffort: 'none',
  notes: '',
  isDefault: false,
  applyToWorkspace: true,
  workspaceApiKey: '',
};

function formatServiceStateLabel(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'Ready';
  if (state === 'blocked') return 'Blocked';
  if (state === 'disabled') return 'Disabled';
  return 'Preview';
}

function getServiceBadgeVariant(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'default' as const;
  if (state === 'blocked') return 'destructive' as const;
  return 'secondary' as const;
}

function getIssueBadgeVariant(severity: 'error' | 'warning' | 'info') {
  if (severity === 'error') return 'destructive' as const;
  if (severity === 'warning') return 'secondary' as const;
  return 'outline' as const;
}

function getWorkspaceIssueAction(issue: {
  code: string;
  blocksRuns: boolean;
}) {
  if (issue.code === 'global_paused') {
    return {
      href: '/admin?tab=agents',
      label: 'Open AI Ops',
    };
  }

  return null;
}

function formatModelConfigSummary(config: AgentModelConfig) {
  const parts: string[] = [];

  if (config.settings.temperature !== null) {
    parts.push(`Temp ${config.settings.temperature}`);
  }
  if (config.settings.maxOutputTokens !== null) {
    parts.push(`${config.settings.maxOutputTokens} max tokens`);
  }
  if (config.settings.reasoningEffort) {
    parts.push(`${config.settings.reasoningEffort} reasoning`);
  }

  return parts.join(' · ') || 'No tuning overrides';
}

function buildModelConfigForm(config?: AgentModelConfig | null): ModelConfigFormState {
  if (!config) {
    return EMPTY_MODEL_CONFIG_FORM;
  }

  return {
    name: config.name,
    provider: config.provider,
    presetModel: getModelCatalogEntry(config.provider, config.model)?.id || '__custom__',
    model: config.model,
    description: config.description || '',
    temperature: config.settings.temperature !== null ? String(config.settings.temperature) : '',
    maxOutputTokens: config.settings.maxOutputTokens !== null ? String(config.settings.maxOutputTokens) : '',
    reasoningEffort: config.settings.reasoningEffort || 'none',
    notes: config.settings.notes || '',
    isDefault: config.isDefault,
    applyToWorkspace: false,
    workspaceApiKey: '',
  };
}

function serializeModelConfigForm(form: ModelConfigFormState) {
  const temperature = form.temperature.trim();
  const maxOutputTokens = form.maxOutputTokens.trim();

  return {
    name: form.name.trim(),
    provider: form.provider,
    model: form.model.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    settings: {
      temperature: temperature ? Number(temperature) : null,
      maxOutputTokens: maxOutputTokens ? Number(maxOutputTokens) : null,
      reasoningEffort: form.reasoningEffort === 'none' ? null : form.reasoningEffort,
      notes: form.notes.trim() ? form.notes.trim() : null,
    },
    isDefault: form.isDefault,
  };
}

function getPresetModelValue(form: ModelConfigFormState) {
  const catalog = getModelCatalogForProvider(form.provider);
  return catalog.some((entry) => entry.id === form.model) ? form.model : '__custom__';
}

export function OrganizationAiAgentsSettings({ organizationId }: { organizationId: string }) {
  const { data, isLoading, error } = useOrganizationAgentSettings(organizationId);
  const updateSettings = useUpdateOrganizationAgentSettings(organizationId);
  const createModelConfig = useCreateOrganizationAgentModelConfig(organizationId);
  const updateModelConfig = useUpdateOrganizationAgentModelConfig(organizationId);
  const archiveModelConfig = useArchiveOrganizationAgentModelConfig(organizationId);
  const { toast } = useToast();
  const [formState, setFormState] = useState<WorkspaceAgentSettings>(EMPTY_SETTINGS);
  const [credentialInput, setCredentialInput] = useState('');
  const [removeStoredCredential, setRemoveStoredCredential] = useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [editingModelConfig, setEditingModelConfig] = useState<AgentModelConfig | null>(null);
  const [modelConfigForm, setModelConfigForm] = useState<ModelConfigFormState>(EMPTY_MODEL_CONFIG_FORM);

  useEffect(() => {
    if (data?.workspaceSettings) {
      setFormState(normalizeWorkspaceAgentSettings(data.workspaceSettings));
      setCredentialInput('');
      setRemoveStoredCredential(false);
    }
  }, [data]);

  const activeModelConfig = useMemo(
    () => data?.modelConfigs.find((config) => config.id === formState.modelConfigId) || null,
    [data?.modelConfigs, formState.modelConfigId]
  );
  const modelCatalog = useMemo(
    () => getModelCatalogForProvider(modelConfigForm.provider),
    [modelConfigForm.provider]
  );
  const selectedModelCatalogEntry = useMemo(
    () => getModelCatalogEntry(modelConfigForm.provider, modelConfigForm.model),
    [modelConfigForm.model, modelConfigForm.provider]
  );
  const supportedReasoningOptions = useMemo(
    () => getSupportedReasoningOptions(modelConfigForm.provider, modelConfigForm.model),
    [modelConfigForm.model, modelConfigForm.provider]
  );
  const supportsReasoning = useMemo(
    () => modelSupportsReasoning(modelConfigForm.provider, modelConfigForm.model),
    [modelConfigForm.model, modelConfigForm.provider]
  );
  const supportsTemperature = useMemo(
    () => modelSupportsTemperature(modelConfigForm.provider, modelConfigForm.model),
    [modelConfigForm.model, modelConfigForm.provider]
  );
  const maxOutputTokensLimit = useMemo(
    () => getModelMaxOutputTokensLimit(modelConfigForm.provider, modelConfigForm.model),
    [modelConfigForm.model, modelConfigForm.provider]
  );

  useEffect(() => {
    setModelConfigForm((current) => {
      const nextReasoningEffort = supportedReasoningOptions.includes(current.reasoningEffort)
        ? current.reasoningEffort
        : supportedReasoningOptions[0] || 'none';
      const nextTemperature = supportsTemperature ? current.temperature : '';
      const nextMaxTokens = current.maxOutputTokens.trim()
        ? String(
            Math.min(
              Number.parseInt(current.maxOutputTokens, 10) || maxOutputTokensLimit,
              maxOutputTokensLimit
            )
          )
        : '';

      if (
        nextReasoningEffort === current.reasoningEffort
        && nextTemperature === current.temperature
        && nextMaxTokens === current.maxOutputTokens
      ) {
        return current;
      }

      return {
        ...current,
        reasoningEffort: nextReasoningEffort,
        temperature: nextTemperature,
        maxOutputTokens: nextMaxTokens,
      };
    });
  }, [maxOutputTokensLimit, supportedReasoningOptions, supportsTemperature]);

  const hasCredentialChanges = Boolean(credentialInput.trim()) || removeStoredCredential;
  const hasChanges = useMemo(
    () =>
      JSON.stringify(formState) !== JSON.stringify(data?.workspaceSettings || EMPTY_SETTINGS)
      || hasCredentialChanges,
    [data?.workspaceSettings, formState, hasCredentialChanges]
  );

  async function handleSave() {
    try {
      const payload: Record<string, unknown> = { ...formState };

      if (formState.provider === 'openai') {
        if (credentialInput.trim()) {
          payload.credential = {
            provider: 'openai',
            apiKey: credentialInput.trim(),
          };
        } else if (removeStoredCredential) {
          payload.credential = {
            provider: 'openai',
            remove: true,
          };
        }
      }

      await updateSettings.mutateAsync(payload);
      setCredentialInput('');
      setRemoveStoredCredential(false);
      toast({
        title: 'Workspace AI agents updated',
        description: hasCredentialChanges
          ? 'Policy and credential settings were saved.'
          : 'The organization-wide agent policy has been saved.',
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to save workspace AI agents',
        description: mutationError instanceof Error ? mutationError.message : 'Failed to save workspace AI agents',
        variant: 'destructive',
      });
    }
  }

  function handleModelSourceChange(value: string) {
    if (value === 'manual') {
      setFormState((current) => ({
        ...current,
        modelConfigId: null,
      }));
      return;
    }

    const nextConfig = data?.modelConfigs.find((config) => config.id === value);
    if (!nextConfig) {
      return;
    }

    setFormState((current) => ({
      ...current,
      modelConfigId: nextConfig.id,
      provider: nextConfig.provider,
      model: nextConfig.model,
    }));
  }

  function openCreateModelConfigDialog() {
    const nextProvider = formState.provider;
    const nextModel = formState.model || getSuggestedModelForProvider(nextProvider);
    setEditingModelConfig(null);
    setModelConfigForm({
      ...EMPTY_MODEL_CONFIG_FORM,
      provider: nextProvider,
      presetModel: getModelCatalogEntry(nextProvider, nextModel)?.id || '__custom__',
      model: nextModel,
      applyToWorkspace: true,
    });
    setIsModelDialogOpen(true);
  }

  function openEditModelConfigDialog(config: AgentModelConfig) {
    setEditingModelConfig(config);
    setModelConfigForm(buildModelConfigForm(config));
    setIsModelDialogOpen(true);
  }

  async function handleSubmitModelConfig() {
    try {
      const payload = serializeModelConfigForm(modelConfigForm);
      let savedConfig: AgentModelConfig | null = null;
      if (editingModelConfig) {
        const result = await updateModelConfig.mutateAsync({
          configId: editingModelConfig.id,
          data: payload,
        });
        savedConfig = result.config;
        toast({
          title: 'Model profile updated',
          description: `${payload.name} was saved and versioned in the workspace registry.`,
        });
      } else {
        const result = await createModelConfig.mutateAsync(payload);
        savedConfig = result.config;
        toast({
          title: 'Model profile created',
          description: `${payload.name} is now available in the workspace model registry.`,
        });
      }

      if (modelConfigForm.provider === 'openai' && modelConfigForm.workspaceApiKey.trim()) {
        await updateSettings.mutateAsync({
          credential: {
            provider: 'openai',
            apiKey: modelConfigForm.workspaceApiKey.trim(),
          },
        });
      }

      if (modelConfigForm.applyToWorkspace && savedConfig) {
        await updateSettings.mutateAsync({
          modelConfigId: savedConfig.id,
        });
      }

      setIsModelDialogOpen(false);
      setEditingModelConfig(null);
      setModelConfigForm(EMPTY_MODEL_CONFIG_FORM);
    } catch (mutationError) {
      toast({
        title: editingModelConfig ? 'Failed to update model profile' : 'Failed to create model profile',
        description: mutationError instanceof Error ? mutationError.message : 'The model profile could not be saved.',
        variant: 'destructive',
      });
    }
  }

  async function handleArchiveModelConfig(config: AgentModelConfig) {
    try {
      await archiveModelConfig.mutateAsync(config.id);
      toast({
        title: 'Model profile archived',
        description: `${config.name} was archived and removed from active selection.`,
      });
    } catch (mutationError) {
      toast({
        title: 'Failed to archive model profile',
        description: mutationError instanceof Error ? mutationError.message : 'The model profile could not be archived.',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading workspace AI agents...</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load workspace AI agents.'}
        </CardContent>
      </Card>
    );
  }

  const canManage = data.access.canManage;

  return (
    <div className="animate-fade-up space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle>Workspace AI & agents</CardTitle>
                <Badge variant="outline">{data.organizationName}</Badge>
              </div>
              <CardDescription>
                Define the provider, write policy, and default capabilities every project inherits.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={formState.enabled ? 'default' : 'secondary'}>
                {formState.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant="outline">{data.access.orgRole || 'member'}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Setup checklist</CardTitle>
              <CardDescription>See what is blocking runs and what is still limited before projects start using agents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.configIssues.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                  Workspace AI is fully configured. Projects can inherit this setup immediately.
                </div>
              ) : (
                data.configIssues.map((issue) => {
                  const action = getWorkspaceIssueAction(issue);

                  return (
                    <div key={`${issue.code}-${issue.scope}`} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{issue.title}</span>
                            <Badge variant={getIssueBadgeVariant(issue.severity)}>
                              {issue.blocksRuns ? 'Blocks runs' : issue.severity === 'warning' ? 'Needs review' : 'Policy note'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.detail}</p>
                          <p className="text-xs text-muted-foreground">{issue.resolution}</p>
                        </div>
                        {action ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={action.href}>
                              {action.label}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="workspace-ai-policy" className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Execution policy</CardTitle>
                <CardDescription>Control how much autonomy the workspace can give agents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
                  <div className="space-y-1">
                    <div className="font-medium">Workspace agents</div>
                    <p className="text-sm text-muted-foreground">Pause or enable all project agent flows in this workspace.</p>
                  </div>
                  <Switch
                    checked={formState.enabled}
                    onCheckedChange={(checked) => setFormState((current) => ({ ...current, enabled: checked }))}
                    disabled={!canManage}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Model source</Label>
                    <Select
                      value={formState.modelConfigId || 'manual'}
                      onValueChange={handleModelSourceChange}
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual provider + model</SelectItem>
                        {data.modelConfigs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name} · {config.provider} · {config.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeModelConfig ? (
                      <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                        Workspace policy is locked to the saved profile <span className="font-medium text-foreground">{activeModelConfig.name}</span>.
                        Provider, model, and tuning come from the DB-backed registry.
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Manual mode keeps provider and model editable directly in workspace policy.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={formState.provider}
                      onValueChange={(value) =>
                        {
                          const nextProvider = value as WorkspaceAgentSettings['provider'];
                          if (nextProvider !== 'openai') {
                            setCredentialInput('');
                            setRemoveStoredCredential(false);
                          }

                          setFormState((current) => {
                            const nextSuggestedModel = getSuggestedModelForProvider(nextProvider);
                            const shouldReplaceModel =
                              !!nextSuggestedModel
                              && (
                                !current.model
                                || current.model === getSuggestedModelForProvider(current.provider)
                              );

                            return {
                              ...current,
                              modelConfigId: null,
                              provider: nextProvider,
                              model: shouldReplaceModel ? nextSuggestedModel : current.model,
                            };
                          });
                        }
                      }
                      disabled={!canManage || Boolean(activeModelConfig)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="native">TaskNebula native</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic (adapter pending)</SelectItem>
                        <SelectItem value="azure">Azure OpenAI (adapter pending)</SelectItem>
                        <SelectItem value="custom">Custom adapter (server work required)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Execution mode</Label>
                    <Select
                      value={formState.executionMode}
                      onValueChange={(value) =>
                        setFormState((current) => ({ ...current, executionMode: value as WorkspaceAgentSettings['executionMode'] }))
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="assistive">Assistive</SelectItem>
                        <SelectItem value="auto">Autonomous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-agent-model">Model</Label>
                    <Input
                      id="workspace-agent-model"
                      value={formState.model}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          modelConfigId: null,
                          model: event.target.value,
                        }))
                      }
                      disabled={!canManage || Boolean(activeModelConfig)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-daily-run-limit">Daily run limit</Label>
                    <Input
                      id="workspace-daily-run-limit"
                      type="number"
                      min={1}
                      max={500}
                      value={formState.dailyRunLimit}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          dailyRunLimit: Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                    <div>
                      <div className="font-medium">Allow write actions</div>
                      <p className="text-sm text-muted-foreground">Permit agents to create or update issues and sprints.</p>
                    </div>
                    <Switch
                      checked={formState.allowWriteActions}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({ ...current, allowWriteActions: checked }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                    <div>
                      <div className="font-medium">Require approval for writes</div>
                      <p className="text-sm text-muted-foreground">Force project runs into preview when the workspace wants human sign-off.</p>
                    </div>
                    <Switch
                      checked={formState.requireApprovalForWrites}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({ ...current, requireApprovalForWrites: checked }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="workspace-ai-provider" className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Provider readiness</CardTitle>
                <CardDescription>Provider availability is checked against the workspace secret store and server environment.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Provider health</span>
                        <Badge variant={data.providerStatus.ready ? 'default' : 'secondary'}>
                          {data.providerStatus.ready ? 'Ready' : 'Blocked'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{data.providerStatus.summary}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 p-4">
                  <div className="space-y-1">
                    <div className="font-medium">Credential source</div>
                    <p className="text-sm text-muted-foreground">
                      {data.providerStatus.configured
                        ? data.providerStatus.source === 'workspace'
                          ? 'This workspace has a stored provider credential.'
                          : 'This provider is being supplied by the server environment.'
                        : 'No runnable credential is configured for the selected provider.'}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
                      <span>Source</span>
                      <span className="font-medium text-foreground">
                        {data.providerStatus.source === 'workspace'
                          ? 'Workspace secret'
                          : data.providerStatus.source === 'server_env'
                            ? 'Server env'
                            : 'Not configured'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
                      <span>Credential</span>
                      <span className="font-medium text-foreground">{data.providerStatus.label || 'None'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
                      <span>Updated</span>
                      <span className="font-medium text-foreground">
                        {data.providerStatus.updatedAt ? new Date(data.providerStatus.updatedAt).toLocaleString() : 'Server managed'}
                      </span>
                    </div>
                  </div>
                </div>

                {formState.provider === 'openai' ? (
                  <div className="rounded-lg border border-border/60 p-4">
                    <div className="space-y-1">
                      <div className="font-medium">OpenAI API key</div>
                      <p className="text-sm text-muted-foreground">
                        Stored server-side and encrypted. If empty, TaskNebula falls back to `OPENAI_API_KEY`.
                      </p>
                    </div>

                    {!data.providerStatus.configured ? (
                      <div className="mt-4 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
                        Runs are blocked until you add a workspace key here or expose `OPENAI_API_KEY` on the server.
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="workspace-openai-key">Workspace credential</Label>
                        <Input
                          id="workspace-openai-key"
                          type="password"
                          placeholder={data.providerStatus.source === 'workspace' ? 'Replace stored key' : 'sk-...'}
                          value={credentialInput}
                          onChange={(event) => {
                            setCredentialInput(event.target.value);
                            if (removeStoredCredential) {
                              setRemoveStoredCredential(false);
                            }
                          }}
                          disabled={!canManage}
                          autoComplete="off"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {data.providerStatus.source === 'workspace' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRemoveStoredCredential((current) => !current)}
                            disabled={!canManage}
                          >
                            {removeStoredCredential ? 'Keep stored key' : 'Remove stored key'}
                          </Button>
                        ) : null}
                        {credentialInput ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCredentialInput('')}
                            disabled={!canManage}
                          >
                            Clear typed key
                          </Button>
                        ) : null}
                      </div>

                      {removeStoredCredential ? (
                        <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
                          The stored workspace key will be removed on save. A server env key, if present, will still keep OpenAI ready.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {!canManage ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-muted-foreground">
                    Workspace owners and admins can update AI agent policy. You currently have read-only access.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="h-4 w-4" />
                    Model registry
                  </CardTitle>
                  <CardDescription>
                    Save reusable provider profiles in the database, keep revision history, and apply one profile to workspace policy.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openCreateModelConfigDialog} disabled={!canManage}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create profile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.modelConfigs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  No saved model profiles yet. Create one to track provider, model, and tuning in the database.
                </div>
              ) : (
                data.modelConfigs.map((config) => {
                  const isApplied = formState.modelConfigId === config.id;

                  return (
                    <div key={config.id} className="rounded-lg border border-border/60 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{config.name}</span>
                            <Badge variant="outline">{config.provider}</Badge>
                            <Badge variant="outline">{config.model}</Badge>
                            {config.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                            {isApplied ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Applied
                              </Badge>
                            ) : null}
                          </div>
                          {config.description ? (
                            <p className="text-sm text-muted-foreground">{config.description}</p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatModelConfigSummary(config)}</span>
                            <span>·</span>
                            <span>{config.revisionCount} revision{config.revisionCount === 1 ? '' : 's'}</span>
                            <span>·</span>
                            <span>Updated {formatDistanceToNow(new Date(config.updatedAt), { addSuffix: true })}</span>
                          </div>
                          {config.settings.notes ? (
                            <p className="text-xs text-muted-foreground">{config.settings.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={isApplied ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => handleModelSourceChange(config.id)}
                            disabled={!canManage || isApplied}
                          >
                            {isApplied ? 'Applied to workspace' : 'Apply'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModelConfigDialog(config)}
                            disabled={!canManage}
                          >
                            <PencilLine className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchiveModelConfig(config)}
                            disabled={!canManage || isApplied || archiveModelConfig.isPending}
                          >
                            <Archive className="mr-2 h-3.5 w-3.5" />
                            Archive
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Default capabilities</CardTitle>
              <CardDescription>Projects inherit these switches unless they intentionally override them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(AGENT_CAPABILITY_DETAILS).map(([key, details]) => (
                <div key={key} className="flex flex-col gap-4 rounded-lg border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{details.label}</span>
                      {details.writes.length > 0 ? (
                        <Badge variant="outline">{details.writes.join(' · ')}</Badge>
                      ) : (
                        <Badge variant="secondary">Read only</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{details.description}</p>
                  </div>
                  <Switch
                    checked={formState.capabilities[key as keyof typeof formState.capabilities]}
                    onCheckedChange={(checked) =>
                      setFormState((current) => ({
                        ...current,
                        capabilities: {
                          ...current.capabilities,
                          [key]: checked,
                        },
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFormState(normalizeWorkspaceAgentSettings(data.workspaceSettings));
                setCredentialInput('');
                setRemoveStoredCredential(false);
              }}
              disabled={!hasChanges || updateSettings.isPending}
            >
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || !canManage || updateSettings.isPending}>
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Save workspace policy
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Workspace runtime
          </CardTitle>
          <CardDescription>Actual execution, service, and run telemetry for this workspace AI setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RuntimeStatCard
              icon={Bot}
              label="Projects with agents"
              value={`${data.runtimeSummary.enabledProjectCount}/${data.runtimeSummary.projectCount}`}
              detail="Projects explicitly enabled for AI"
            />
            <RuntimeStatCard
              icon={Cpu}
              label="Running now"
              value={String(data.runtimeSummary.runningRuns)}
              detail="Live agent runs in this workspace"
            />
            <RuntimeStatCard
              icon={Activity}
              label="Total runs"
              value={String(data.runtimeSummary.totalRuns)}
              detail="Recorded in agent run history"
            />
            <RuntimeStatCard
              icon={Clock3}
              label="Last completed"
              value={
                data.runtimeSummary.lastCompletedAt
                  ? formatDistanceToNow(new Date(data.runtimeSummary.lastCompletedAt), { addSuffix: true })
                  : 'None yet'
              }
              detail="Most recent successful or preview completion"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Service status</CardTitle>
                <CardDescription>What is actually runnable right now.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.serviceStatus.map((service) => (
                  <div key={service.key} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{service.label}</span>
                      <Badge variant={getServiceBadgeVariant(service.state)}>
                        {formatServiceStateLabel(service.state)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{service.detail}</p>
                  </div>
                ))}

                {data.runtimeSummary.lastFailure ? (
                  <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber">
                    Last failure: {data.runtimeSummary.lastFailure}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Recent workspace runs</CardTitle>
                <CardDescription>Last agent activity across projects in this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentRuns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    No runs recorded yet.
                  </div>
                ) : (
                  data.recentRuns.map((run) => (
                    <div key={run.id} className="rounded-lg border border-border/60 p-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{run.kind.replaceAll('_', ' ')}</span>
                            <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                              {run.status}
                            </Badge>
                            <Badge variant="outline">{run.dryRun ? 'Preview' : 'Live'}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {run.projectName || 'Unknown project'}
                            {run.initiatedBy ? ` · ${run.initiatedBy}` : ''}
                          </div>
                          {run.summary ? <p className="text-sm text-muted-foreground">{run.summary}</p> : null}
                          {run.error ? <p className="text-sm text-destructive">{run.error}</p> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isModelDialogOpen}
        onOpenChange={(open) => {
          setIsModelDialogOpen(open);
          if (!open) {
            setEditingModelConfig(null);
            setModelConfigForm(EMPTY_MODEL_CONFIG_FORM);
          }
        }}
      >
        <DialogContent className="flex h-[min(92vh,860px)] w-[min(96vw,72rem)] max-w-[72rem] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 sm:px-6">
            <DialogTitle>{editingModelConfig ? 'Edit model profile' : 'Create model profile'}</DialogTitle>
            <DialogDescription>
              Save provider, model, and tuning in the database so the workspace can reuse them consistently.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
              <Label htmlFor="model-config-name">Profile name</Label>
              <Input
                id="model-config-name"
                value={modelConfigForm.name}
                onChange={(event) => setModelConfigForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="OpenAI GPT-5 Ops"
              />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={modelConfigForm.provider}
                      onValueChange={(value) =>
                        setModelConfigForm((current) => {
                          const nextProvider = value as AgentProvider;
                          const nextSuggestedModel = getSuggestedModelForProvider(nextProvider);
                          const nextCatalogEntry = nextSuggestedModel
                            ? getModelCatalogEntry(nextProvider, nextSuggestedModel)
                            : null;

                          return {
                            ...current,
                            provider: nextProvider,
                            presetModel: nextCatalogEntry?.id || '__custom__',
                            model:
                              nextSuggestedModel
                              && (!current.model || current.model === current.presetModel || current.presetModel !== '__custom__')
                                ? nextSuggestedModel
                                : current.model,
                          };
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="native">TaskNebula native</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                        <SelectItem value="custom">Custom adapter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {modelCatalog.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Current model quick picks</Label>
                    <Select
                      value={getPresetModelValue(modelConfigForm)}
                      onValueChange={(value) =>
                        setModelConfigForm((current) => ({
                          ...current,
                          presetModel: value,
                          model: value === '__custom__' ? current.model : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelCatalog.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Custom model ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="model-config-model">Model</Label>
                  <Input
                    id="model-config-model"
                    value={modelConfigForm.model}
                    onChange={(event) =>
                      setModelConfigForm((current) => ({
                        ...current,
                        presetModel: '__custom__',
                        model: event.target.value,
                      }))
                    }
                    placeholder="gpt-5.4"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-config-description">Description</Label>
                  <Input
                    id="model-config-description"
                    value={modelConfigForm.description}
                    onChange={(event) => setModelConfigForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Balanced planning profile for workspace operations"
                  />
                </div>

                {selectedModelCatalogEntry ? (
                  <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedModelCatalogEntry.label}</span>
                    {' · '}
                    {selectedModelCatalogEntry.summary}
                    {' · '}
                    Max output up to {selectedModelCatalogEntry.maxOutputTokensLimit.toLocaleString()} tokens.
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 p-4">
                  <div className="mb-4">
                    <div className="font-medium">Tuning</div>
                    <p className="text-xs text-muted-foreground">
                      Parameter inputs adapt to the selected model preset.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="model-config-temperature">Temperature</Label>
                      <Input
                        id="model-config-temperature"
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={modelConfigForm.temperature}
                        onChange={(event) => setModelConfigForm((current) => ({ ...current, temperature: event.target.value }))}
                        placeholder="Optional"
                        disabled={!supportsTemperature}
                      />
                      {!supportsTemperature ? (
                        <p className="text-xs text-muted-foreground">This model is set up without a temperature override.</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model-config-max-output">Max output tokens</Label>
                      <Input
                        id="model-config-max-output"
                        type="number"
                        min={32}
                        max={maxOutputTokensLimit}
                        step={1}
                        value={modelConfigForm.maxOutputTokens}
                        onChange={(event) =>
                          setModelConfigForm((current) => ({ ...current, maxOutputTokens: event.target.value }))
                        }
                        placeholder={`Up to ${maxOutputTokensLimit.toLocaleString()}`}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label>Reasoning effort</Label>
                      <Select
                        value={modelConfigForm.reasoningEffort}
                        onValueChange={(value) =>
                          setModelConfigForm((current) => ({
                            ...current,
                            reasoningEffort: value as ModelConfigFormState['reasoningEffort'],
                          }))
                        }
                        disabled={!supportsReasoning}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedReasoningOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option === 'none' ? 'No override' : option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!supportsReasoning ? (
                        <p className="text-xs text-muted-foreground">This model preset is treated as a non-reasoning/chat model.</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border/60 p-4">
                  <div className="font-medium">Workspace behavior</div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
                    <div>
                      <div className="font-medium">Default profile</div>
                      <p className="text-xs text-muted-foreground">Keep this profile highlighted in the registry.</p>
                    </div>
                    <Switch
                      checked={modelConfigForm.isDefault}
                      onCheckedChange={(checked) => setModelConfigForm((current) => ({ ...current, isDefault: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
                    <div>
                      <div className="font-medium">Apply to workspace after save</div>
                      <p className="text-xs text-muted-foreground">Switch the workspace policy to this profile immediately.</p>
                    </div>
                    <Switch
                      checked={modelConfigForm.applyToWorkspace}
                      onCheckedChange={(checked) =>
                        setModelConfigForm((current) => ({ ...current, applyToWorkspace: checked }))
                      }
                    />
                  </div>

                  {modelConfigForm.provider === 'openai' ? (
                    <div className="space-y-2 rounded-lg border border-border/60 px-4 py-3">
                      <Label htmlFor="model-config-openai-key">Workspace OpenAI API key</Label>
                      <Input
                        id="model-config-openai-key"
                        type="password"
                        value={modelConfigForm.workspaceApiKey}
                        onChange={(event) =>
                          setModelConfigForm((current) => ({ ...current, workspaceApiKey: event.target.value }))
                        }
                        placeholder={
                          data.providerStatus.source === 'workspace'
                            ? 'Leave empty to keep current stored key'
                            : 'sk-...'
                        }
                        autoComplete="off"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional. Save or rotate the workspace OpenAI key while creating the profile.
                      </p>
                      {formState.provider === 'openai' && !data.providerStatus.configured ? (
                        <div className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
                          No runnable OpenAI key is configured right now. Add one here or provide `OPENAI_API_KEY` on the server.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-config-notes">Ops notes</Label>
                  <Textarea
                    id="model-config-notes"
                    value={modelConfigForm.notes}
                    onChange={(event) => setModelConfigForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Why this profile exists, rollout notes, or provider caveats."
                    rows={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModelDialogOpen(false);
                setEditingModelConfig(null);
                setModelConfigForm(EMPTY_MODEL_CONFIG_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitModelConfig}
              disabled={
                !modelConfigForm.name.trim()
                || !modelConfigForm.model.trim()
                || createModelConfig.isPending
                || updateModelConfig.isPending
              }
            >
              {(createModelConfig.isPending || updateModelConfig.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : editingModelConfig ? 'Save profile' : 'Create profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuntimeStatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
