'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AiQuickSetup } from './ai-quick-setup';
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
  provider: 'native',
  model: 'tasknebula-planner-v1',
  modelConfigId: null,
  assistantEnabled: false,
  enabled: false,
  executionMode: 'manual',
  allowWriteActions: false,
  requireApprovalForWrites: true,
  dailyRunLimit: 20,
  capabilities: {
    project_tracking: false,
    backlog_triage: false,
    sprint_planning: false,
    bulk_sprint_creation: false,
  },
  // EU AI Act Article 50: conservative default for human-oversight posture.
  aiOversight: 'review_required',
  // P1-16 prompt-injection safety: default to warn.
  aiSafetyMode: 'warn',
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

function serviceStateLabelKey(state: 'ready' | 'blocked' | 'disabled' | 'preview') {
  if (state === 'ready') return 'orgAi.state_ready';
  if (state === 'blocked') return 'orgAi.state_blocked';
  if (state === 'disabled') return 'orgAi.state_disabled';
  return 'orgAi.state_preview';
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

function getWorkspaceIssueAction(issue: { code: string; blocksRuns: boolean }) {
  if (issue.code === 'global_paused') {
    return {
      href: '/admin?tab=agents',
      labelKey: 'orgAi.open_ai_ops',
    };
  }

  return null;
}

function formatModelConfigSummary(
  config: AgentModelConfig,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const parts: string[] = [];

  if (config.settings.temperature !== null) {
    parts.push(t('orgAi.summary_temp', { value: config.settings.temperature }));
  }
  if (config.settings.maxOutputTokens !== null) {
    parts.push(t('orgAi.summary_max_tokens', { value: config.settings.maxOutputTokens }));
  }
  if (config.settings.reasoningEffort) {
    parts.push(t('orgAi.summary_reasoning', { value: config.settings.reasoningEffort }));
  }

  return parts.join(' · ') || t('orgAi.no_tuning_overrides');
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
    maxOutputTokens:
      config.settings.maxOutputTokens !== null ? String(config.settings.maxOutputTokens) : '',
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
  const t = useTranslations('settingsConfig');
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
  const [modelConfigForm, setModelConfigForm] =
    useState<ModelConfigFormState>(EMPTY_MODEL_CONFIG_FORM);

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
        nextReasoningEffort === current.reasoningEffort &&
        nextTemperature === current.temperature &&
        nextMaxTokens === current.maxOutputTokens
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
      JSON.stringify(formState) !== JSON.stringify(data?.workspaceSettings || EMPTY_SETTINGS) ||
      hasCredentialChanges,
    [data?.workspaceSettings, formState, hasCredentialChanges]
  );

  async function handleSave() {
    try {
      const payload: Record<string, unknown> = { ...formState };

      if (formState.provider === 'openai' || formState.provider === 'anthropic') {
        if (credentialInput.trim()) {
          payload.credential = {
            provider: formState.provider,
            apiKey: credentialInput.trim(),
          };
        } else if (removeStoredCredential) {
          payload.credential = {
            provider: formState.provider,
            remove: true,
          };
        }
      }

      await updateSettings.mutateAsync(payload);
      setCredentialInput('');
      setRemoveStoredCredential(false);
      toast({
        title: t('orgAi.saved_toast_title'),
        description: hasCredentialChanges
          ? t('orgAi.saved_toast_desc_credential')
          : t('orgAi.saved_toast_desc_policy'),
      });
    } catch (mutationError) {
      toast({
        title: t('orgAi.save_failed_title'),
        description:
          mutationError instanceof Error ? mutationError.message : t('orgAi.save_failed_title'),
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
          title: t('orgAi.profile_updated_title'),
          description: t('orgAi.profile_updated_desc', { name: payload.name }),
        });
      } else {
        const result = await createModelConfig.mutateAsync(payload);
        savedConfig = result.config;
        toast({
          title: t('orgAi.profile_created_title'),
          description: t('orgAi.profile_created_desc', { name: payload.name }),
        });
      }

      if (
        (modelConfigForm.provider === 'openai' || modelConfigForm.provider === 'anthropic') &&
        modelConfigForm.workspaceApiKey.trim()
      ) {
        await updateSettings.mutateAsync({
          credential: {
            provider: modelConfigForm.provider,
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
        title: editingModelConfig
          ? t('orgAi.profile_update_failed')
          : t('orgAi.profile_create_failed'),
        description:
          mutationError instanceof Error
            ? mutationError.message
            : t('orgAi.profile_save_failed_desc'),
        variant: 'destructive',
      });
    }
  }

  async function handleArchiveModelConfig(config: AgentModelConfig) {
    try {
      await archiveModelConfig.mutateAsync(config.id);
      toast({
        title: t('orgAi.profile_archived_title'),
        description: t('orgAi.profile_archived_desc', { name: config.name }),
      });
    } catch (mutationError) {
      toast({
        title: t('orgAi.profile_archive_failed'),
        description:
          mutationError instanceof Error
            ? mutationError.message
            : t('orgAi.profile_archive_failed_desc'),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('orgAi.loading')}</div>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="text-destructive py-8 text-sm">
          {error instanceof Error ? error.message : t('orgAi.load_error')}
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
                <CardTitle>{t('orgAi.title')}</CardTitle>
                <Badge variant="outline">{data.organizationName}</Badge>
              </div>
              <CardDescription>{t('orgAi.subtitle')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={formState.enabled ? 'default' : 'secondary'}>
                {formState.enabled ? t('orgAi.enabled') : t('orgAi.disabled')}
              </Badge>
              <Badge variant="outline">{data.access.orgRole || 'member'}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <AiQuickSetup
            organizationId={data.organizationId}
            workspaceSettings={formState}
            providerConfigured={data.providerStatus.configured === true}
            providerSource={data.providerStatus.source}
            canManage={canManage}
            savedProfiles={data.modelConfigs.map((c) => ({
              id: c.id,
              name: c.name,
              provider: c.provider,
              model: c.model,
            }))}
            onManageProfiles={() => {
              document
                .getElementById('workspace-model-profiles')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">{t('orgAi.checklist_title')}</CardTitle>
              <CardDescription>{t('orgAi.checklist_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.configIssues.length === 0 ? (
                <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
                  {t('orgAi.checklist_complete')}
                </div>
              ) : (
                data.configIssues.map((issue) => {
                  const action = getWorkspaceIssueAction(issue);

                  return (
                    <div
                      key={`${issue.code}-${issue.scope}`}
                      className="border-border/60 rounded-lg border p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{issue.title}</span>
                            <Badge variant={getIssueBadgeVariant(issue.severity)}>
                              {issue.blocksRuns
                                ? t('orgAi.blocks_runs')
                                : issue.severity === 'warning'
                                  ? t('orgAi.needs_review')
                                  : t('orgAi.policy_note')}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-sm">{issue.detail}</p>
                          <p className="text-muted-foreground text-xs">{issue.resolution}</p>
                        </div>
                        {action ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={action.href}>
                              {t(action.labelKey)}
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

          {/* AI Assistant toggle lives inside the Quick Setup card above —
               rendering it again here created a "did I set this up twice?"
               moment for admins. Quick Setup owns both the toggle and the
               provider/model/key trio in a single "Enable AI Assistant"
               button, so this card is redundant. */}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="workspace-ai-policy" className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('orgAi.exec_policy_title')}</CardTitle>
                <CardDescription>{t('orgAi.exec_policy_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="font-medium">{t('orgAi.workspace_agents')}</div>
                    <p className="text-muted-foreground text-sm">
                      {t('orgAi.workspace_agents_desc')}
                    </p>
                  </div>
                  <Switch
                    checked={formState.enabled}
                    onCheckedChange={(checked) =>
                      setFormState((current) => ({ ...current, enabled: checked }))
                    }
                    disabled={!canManage}
                  />
                </div>

                <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border p-3 text-xs">
                  {t('orgAi.provider_note')}
                  {activeModelConfig && (
                    <span className="ml-1">
                      {t('orgAi.locked_profile_prefix')}{' '}
                      <span className="text-foreground font-medium">{activeModelConfig.name}</span>
                      {'.'}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('orgAi.execution_mode')}</Label>
                    <Select
                      value={formState.executionMode}
                      onValueChange={(value) =>
                        setFormState((current) => ({
                          ...current,
                          executionMode: value as WorkspaceAgentSettings['executionMode'],
                        }))
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{t('orgAi.mode_manual')}</SelectItem>
                        <SelectItem value="assistive">{t('orgAi.mode_assistive')}</SelectItem>
                        <SelectItem value="auto">{t('orgAi.mode_autonomous')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-daily-run-limit">{t('orgAi.daily_run_limit')}</Label>
                    <Input
                      id="workspace-daily-run-limit"
                      type="number"
                      min={1}
                      max={500}
                      value={formState.dailyRunLimit}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          dailyRunLimit: Math.max(
                            1,
                            Number.parseInt(event.target.value || '1', 10) || 1
                          ),
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">{t('orgAi.allow_writes')}</div>
                      <p className="text-muted-foreground text-sm">
                        {t('orgAi.allow_writes_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={formState.allowWriteActions}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({ ...current, allowWriteActions: checked }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                  <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">{t('orgAi.require_approval')}</div>
                      <p className="text-muted-foreground text-sm">
                        {t('orgAi.require_approval_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={formState.requireApprovalForWrites}
                      onCheckedChange={(checked) =>
                        setFormState((current) => ({
                          ...current,
                          requireApprovalForWrites: checked,
                        }))
                      }
                      disabled={!canManage}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="workspace-ai-provider" className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('orgAi.provider_readiness')}</CardTitle>
                <CardDescription>{t('orgAi.provider_readiness_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-border/60 rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <div className="border-border/60 bg-muted/30 flex h-9 w-9 items-center justify-center rounded-lg border">
                      <Cpu className="text-muted-foreground h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t('orgAi.provider_health')}</span>
                        <Badge variant={data.providerStatus.ready ? 'default' : 'secondary'}>
                          {data.providerStatus.ready ? t('orgAi.ready') : t('orgAi.blocked')}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{data.providerStatus.summary}</p>
                    </div>
                  </div>
                </div>

                <div className="border-border/60 rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="font-medium">{t('orgAi.credential_source')}</div>
                    <p className="text-muted-foreground text-sm">
                      {data.providerStatus.configured
                        ? data.providerStatus.source === 'workspace'
                          ? t('orgAi.cred_workspace_stored')
                          : t('orgAi.cred_server_supplied')
                        : t('orgAi.cred_none_configured')}
                    </p>
                  </div>
                  <div className="text-muted-foreground mt-3 grid gap-2 text-sm">
                    <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                      <span>{t('orgAi.source')}</span>
                      <span className="text-foreground font-medium">
                        {data.providerStatus.source === 'workspace'
                          ? t('orgAi.workspace_secret')
                          : data.providerStatus.source === 'server_env'
                            ? t('orgAi.server_env')
                            : t('orgAi.not_configured')}
                      </span>
                    </div>
                    <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                      <span>{t('orgAi.credential')}</span>
                      <span className="text-foreground font-medium">
                        {data.providerStatus.label || t('orgAi.none')}
                      </span>
                    </div>
                    <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                      <span>{t('orgAi.updated')}</span>
                      <span className="text-foreground font-medium">
                        {data.providerStatus.updatedAt
                          ? new Date(data.providerStatus.updatedAt).toLocaleString()
                          : t('orgAi.server_managed')}
                      </span>
                    </div>
                  </div>
                </div>

                {!canManage ? (
                  <div className="panel-warn text-sm">{t('orgAi.read_only_notice')}</div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card id="workspace-model-profiles" className="border-border/60">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="h-4 w-4" />
                    {t('orgAi.your_model_profiles')}
                  </CardTitle>
                  <CardDescription>{t('orgAi.your_model_profiles_desc')}</CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={openCreateModelConfigDialog}
                  disabled={!canManage}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('orgAi.create_profile')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.modelConfigs.length === 0 ? (
                <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                  {t('orgAi.no_profiles')}
                </div>
              ) : (
                data.modelConfigs.map((config) => {
                  const isApplied = formState.modelConfigId === config.id;

                  return (
                    <div key={config.id} className="border-border/60 rounded-lg border p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{config.name}</span>
                            <Badge variant="outline">{config.provider}</Badge>
                            <Badge variant="outline">{config.model}</Badge>
                            {config.isDefault ? (
                              <Badge variant="secondary">{t('orgAi.default')}</Badge>
                            ) : null}
                            {isApplied ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('orgAi.applied')}
                              </Badge>
                            ) : null}
                          </div>
                          {config.description ? (
                            <p className="text-muted-foreground text-sm">{config.description}</p>
                          ) : null}
                          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                            <span>{formatModelConfigSummary(config, t)}</span>
                            <span>{'·'}</span>
                            <span>{t('orgAi.revisions', { count: config.revisionCount })}</span>
                            <span>{'·'}</span>
                            <span>
                              {t('orgAi.updated_ago', {
                                ago: formatDistanceToNow(new Date(config.updatedAt), {
                                  addSuffix: true,
                                }),
                              })}
                            </span>
                          </div>
                          {config.settings.notes ? (
                            <p className="text-muted-foreground text-xs">{config.settings.notes}</p>
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
                            {isApplied ? t('orgAi.applied_to_workspace') : t('orgAi.apply')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModelConfigDialog(config)}
                            disabled={!canManage}
                          >
                            <PencilLine className="mr-2 h-3.5 w-3.5" />
                            {t('orgAi.edit')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchiveModelConfig(config)}
                            disabled={!canManage || isApplied || archiveModelConfig.isPending}
                          >
                            <Archive className="mr-2 h-3.5 w-3.5" />
                            {t('orgAi.archive')}
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
              <CardTitle className="text-base">{t('orgAi.default_capabilities')}</CardTitle>
              <CardDescription>{t('orgAi.default_capabilities_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(AGENT_CAPABILITY_DETAILS).map(([key, details]) => (
                <div
                  key={key}
                  className="border-border/60 flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{details.label}</span>
                      {details.writes.length > 0 ? (
                        <Badge variant="outline">{details.writes.join(' · ')}</Badge>
                      ) : (
                        <Badge variant="secondary">{t('orgAi.read_only')}</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">{details.description}</p>
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
              {t('orgAi.reset')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || !canManage || updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('orgAi.saving')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('orgAi.save_workspace_policy')}
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
            {t('orgAi.workspace_runtime')}
          </CardTitle>
          <CardDescription>{t('orgAi.workspace_runtime_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RuntimeStatCard
              icon={Bot}
              label={t('orgAi.stat_projects_with_agents')}
              value={`${data.runtimeSummary.enabledProjectCount}/${data.runtimeSummary.projectCount}`}
              detail={t('orgAi.stat_projects_with_agents_detail')}
            />
            <RuntimeStatCard
              icon={Cpu}
              label={t('orgAi.stat_running_now')}
              value={String(data.runtimeSummary.runningRuns)}
              detail={t('orgAi.stat_running_now_detail')}
            />
            <RuntimeStatCard
              icon={Activity}
              label={t('orgAi.stat_total_runs')}
              value={String(data.runtimeSummary.totalRuns)}
              detail={t('orgAi.stat_total_runs_detail')}
            />
            <RuntimeStatCard
              icon={Clock3}
              label={t('orgAi.stat_last_completed')}
              value={
                data.runtimeSummary.lastCompletedAt
                  ? formatDistanceToNow(new Date(data.runtimeSummary.lastCompletedAt), {
                      addSuffix: true,
                    })
                  : t('orgAi.none_yet')
              }
              detail={t('orgAi.stat_last_completed_detail')}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('orgAi.service_status')}</CardTitle>
                <CardDescription>{t('orgAi.service_status_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.serviceStatus.map((service) => (
                  <div key={service.key} className="border-border/60 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{service.label}</span>
                      <Badge variant={getServiceBadgeVariant(service.state)}>
                        {t(serviceStateLabelKey(service.state))}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">{service.detail}</p>
                  </div>
                ))}

                {data.runtimeSummary.lastFailure ? (
                  <div className="border-accent-amber/30 bg-accent-amber/10 text-accent-amber rounded-lg border px-3 py-2 text-sm">
                    {t('orgAi.last_failure', { error: data.runtimeSummary.lastFailure })}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{t('orgAi.recent_runs')}</CardTitle>
                <CardDescription>{t('orgAi.recent_runs_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentRuns.length === 0 ? (
                  <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                    {t('orgAi.no_runs')}
                  </div>
                ) : (
                  data.recentRuns.map((run) => (
                    <div key={run.id} className="border-border/60 rounded-lg border p-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{run.kind.replaceAll('_', ' ')}</span>
                            <Badge
                              variant={
                                run.status === 'completed'
                                  ? 'default'
                                  : run.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {run.status}
                            </Badge>
                            <Badge variant="outline">
                              {run.dryRun ? t('orgAi.preview') : t('orgAi.live')}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {run.projectName || t('orgAi.unknown_project')}
                            {run.initiatedBy ? ` · ${run.initiatedBy}` : ''}
                          </div>
                          {run.summary ? (
                            <p className="text-muted-foreground text-sm">{run.summary}</p>
                          ) : null}
                          {run.error ? (
                            <p className="text-destructive text-sm">{run.error}</p>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground text-xs">
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
          <DialogHeader className="border-border/60 shrink-0 border-b px-5 py-4 sm:px-6">
            <DialogTitle>
              {editingModelConfig ? t('orgAi.dialog_edit_title') : t('orgAi.dialog_create_title')}
            </DialogTitle>
            <DialogDescription>{t('orgAi.dialog_desc')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="model-config-name">{t('orgAi.profile_name')}</Label>
                    <Input
                      id="model-config-name"
                      value={modelConfigForm.name}
                      onChange={(event) =>
                        setModelConfigForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder={t('orgAi.profile_name_placeholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('orgAi.provider')}</Label>
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
                              nextSuggestedModel &&
                              (!current.model ||
                                current.model === current.presetModel ||
                                current.presetModel !== '__custom__')
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
                        <SelectItem value="native">{t('orgAi.provider_native')}</SelectItem>
                        <SelectItem value="openai">{'OpenAI'}</SelectItem>
                        <SelectItem value="anthropic">{'Anthropic'}</SelectItem>
                        <SelectItem value="azure">{'Azure OpenAI'}</SelectItem>
                        <SelectItem value="custom">{t('orgAi.provider_custom')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {modelCatalog.length > 0 ? (
                  <div className="space-y-2">
                    <Label>{t('orgAi.quick_picks')}</Label>
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
                        <SelectItem value="__custom__">{t('orgAi.custom_model_id')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="model-config-model">{t('orgAi.model')}</Label>
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
                  <Label htmlFor="model-config-description">{t('orgAi.description')}</Label>
                  <Input
                    id="model-config-description"
                    value={modelConfigForm.description}
                    onChange={(event) =>
                      setModelConfigForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder={t('orgAi.description_placeholder')}
                  />
                </div>

                {selectedModelCatalogEntry ? (
                  <div className="border-border/60 bg-muted/10 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
                    <span className="text-foreground font-medium">
                      {selectedModelCatalogEntry.label}
                    </span>
                    {' · '}
                    {selectedModelCatalogEntry.summary}
                    {' · '}
                    {t('orgAi.max_output_up_to', {
                      tokens: selectedModelCatalogEntry.maxOutputTokensLimit.toLocaleString(),
                    })}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="border-border/60 rounded-lg border p-4">
                  <div className="mb-4">
                    <div className="font-medium">{t('orgAi.tuning')}</div>
                    <p className="text-muted-foreground text-xs">{t('orgAi.tuning_desc')}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="model-config-temperature">{t('orgAi.temperature')}</Label>
                      <Input
                        id="model-config-temperature"
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={modelConfigForm.temperature}
                        onChange={(event) =>
                          setModelConfigForm((current) => ({
                            ...current,
                            temperature: event.target.value,
                          }))
                        }
                        placeholder={t('orgAi.optional')}
                        disabled={!supportsTemperature}
                      />
                      {!supportsTemperature ? (
                        <p className="text-muted-foreground text-xs">
                          {t('orgAi.no_temp_override')}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model-config-max-output">
                        {t('orgAi.max_output_tokens')}
                      </Label>
                      <Input
                        id="model-config-max-output"
                        type="number"
                        min={32}
                        max={maxOutputTokensLimit}
                        step={1}
                        value={modelConfigForm.maxOutputTokens}
                        onChange={(event) =>
                          setModelConfigForm((current) => ({
                            ...current,
                            maxOutputTokens: event.target.value,
                          }))
                        }
                        placeholder={t('orgAi.up_to', {
                          tokens: maxOutputTokensLimit.toLocaleString(),
                        })}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t('orgAi.reasoning_effort')}</Label>
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
                              {option === 'none' ? t('orgAi.no_override') : option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!supportsReasoning ? (
                        <p className="text-muted-foreground text-xs">
                          {t('orgAi.non_reasoning_hint')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="border-border/60 space-y-3 rounded-lg border p-4">
                  <div className="font-medium">{t('orgAi.workspace_behavior')}</div>
                  <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div>
                      <div className="font-medium">{t('orgAi.default_profile')}</div>
                      <p className="text-muted-foreground text-xs">
                        {t('orgAi.default_profile_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={modelConfigForm.isDefault}
                      onCheckedChange={(checked) =>
                        setModelConfigForm((current) => ({ ...current, isDefault: checked }))
                      }
                    />
                  </div>

                  <div className="border-border/60 flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div>
                      <div className="font-medium">{t('orgAi.apply_after_save')}</div>
                      <p className="text-muted-foreground text-xs">
                        {t('orgAi.apply_after_save_desc')}
                      </p>
                    </div>
                    <Switch
                      checked={modelConfigForm.applyToWorkspace}
                      onCheckedChange={(checked) =>
                        setModelConfigForm((current) => ({ ...current, applyToWorkspace: checked }))
                      }
                    />
                  </div>

                  {modelConfigForm.provider === 'openai' || modelConfigForm.provider === 'anthropic'
                    ? (() => {
                        const label =
                          modelConfigForm.provider === 'openai' ? 'OpenAI' : 'Anthropic';
                        const placeholder =
                          modelConfigForm.provider === 'openai' ? 'sk-...' : 'sk-ant-...';
                        const envVar =
                          modelConfigForm.provider === 'openai'
                            ? 'OPENAI_API_KEY'
                            : 'ANTHROPIC_API_KEY';
                        return (
                          <div className="border-border/60 space-y-2 rounded-lg border px-4 py-3">
                            <Label htmlFor="model-config-provider-key">
                              {t('orgAi.workspace_provider_key', { label })}
                            </Label>
                            <Input
                              id="model-config-provider-key"
                              type="password"
                              value={modelConfigForm.workspaceApiKey}
                              onChange={(event) =>
                                setModelConfigForm((current) => ({
                                  ...current,
                                  workspaceApiKey: event.target.value,
                                }))
                              }
                              placeholder={
                                data.providerStatus.source === 'workspace'
                                  ? t('orgAi.key_keep_placeholder')
                                  : placeholder
                              }
                              autoComplete="off"
                            />
                            <p className="text-muted-foreground text-xs">
                              {t('orgAi.provider_key_hint', { label })}
                            </p>
                            {formState.provider === modelConfigForm.provider &&
                            !data.providerStatus.configured ? (
                              <div className="border-accent-amber/30 bg-accent-amber/10 text-accent-amber rounded-lg border px-3 py-2 text-xs">
                                {t('orgAi.no_runnable_key_prefix', { label })} <code>{envVar}</code>{' '}
                                {t('orgAi.no_runnable_key_suffix')}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()
                    : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-config-notes">{t('orgAi.ops_notes')}</Label>
                  <Textarea
                    id="model-config-notes"
                    value={modelConfigForm.notes}
                    onChange={(event) =>
                      setModelConfigForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder={t('orgAi.ops_notes_placeholder')}
                    rows={6}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-border/60 shrink-0 border-t px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModelDialogOpen(false);
                setEditingModelConfig(null);
                setModelConfigForm(EMPTY_MODEL_CONFIG_FORM);
              }}
            >
              {t('orgAi.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmitModelConfig}
              disabled={
                !modelConfigForm.name.trim() ||
                !modelConfigForm.model.trim() ||
                createModelConfig.isPending ||
                updateModelConfig.isPending
              }
            >
              {createModelConfig.isPending || updateModelConfig.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('orgAi.saving')}
                </>
              ) : editingModelConfig ? (
                t('orgAi.save_profile')
              ) : (
                t('orgAi.create_profile')
              )}
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
    <div className="border-border/60 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">{label}</p>
        <Icon className="text-muted-foreground h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{detail}</p>
    </div>
  );
}
