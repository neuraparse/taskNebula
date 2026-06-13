'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  Edit,
  Zap,
  ArrowRight,
  History,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: {
    type: string;
    event?: string;
    field?: string;
  };
  conditions: Array<Record<string, unknown>>;
  actions: Array<{ type: string }>;
}

interface AutomationExecution {
  id: string;
  ruleId: string;
  triggeredAt: string;
  triggerPayload: unknown;
  status: string;
  actionResults: unknown;
  durationMs: number | null;
  error: string | null;
}

type ExecutionStatusVariant = 'success' | 'destructive' | 'warning' | 'info' | 'muted';

function executionStatusVariant(status: string): ExecutionStatusVariant {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'skipped':
      return 'muted';
    case 'matched':
      return 'info';
    default:
      return 'warning';
  }
}

function executionActionCount(actionResults: unknown): number {
  return Array.isArray(actionResults) ? actionResults.length : 0;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs == null) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const TRIGGER_TYPES = [
  { value: 'issue_created', labelKey: 'automation.triggers.issue_created' },
  { value: 'issue_updated', labelKey: 'automation.triggers.issue_updated' },
  { value: 'issue_transitioned', labelKey: 'automation.triggers.issue_transitioned' },
  { value: 'issue_assigned', labelKey: 'automation.triggers.issue_assigned' },
  { value: 'issue_commented', labelKey: 'automation.triggers.issue_commented' },
  { value: 'schedule', labelKey: 'automation.triggers.schedule' },
];

const ACTION_TYPES = [
  { value: 'assign_issue', labelKey: 'automation.actions.assign_issue' },
  { value: 'transition_issue', labelKey: 'automation.actions.transition_issue' },
  { value: 'add_comment', labelKey: 'automation.actions.add_comment' },
  { value: 'update_field', labelKey: 'automation.actions.update_field' },
  { value: 'send_notification', labelKey: 'automation.actions.send_notification' },
  { value: 'send_email', labelKey: 'automation.actions.send_email' },
];

interface AutomationManagerProps {
  organizationId: string;
  projectId?: string;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  enabled: true,
  triggerType: 'issue_created',
  actionType: 'assign_issue',
};

// Two-column row for label + control. Keeps forms calm and scannable.
function FormRow({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[240px_1fr]">
      <div className="space-y-1 pt-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function AutomationManager({ organizationId, projectId }: AutomationManagerProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [executionsRule, setExecutionsRule] = useState<AutomationRule | null>(null);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const { toast } = useToast();
  const t = useTranslations('workspaceTools');

  useEffect(() => {
    void fetchRules();
  }, [organizationId, projectId]);

  async function fetchRules() {
    setIsLoading(true);

    try {
      let url = `/api/automation-rules?organizationId=${organizationId}`;
      if (projectId) {
        url += `&projectId=${projectId}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch automation rules');
      }

      const data = await response.json();
      setRules(data);
    } catch (error) {
      toast({
        title: t('automation.toast.errorTitle'),
        description: t('automation.toast.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm() {
    setFormMode(null);
    setEditingRuleId(null);
    setFormData(EMPTY_FORM);
  }

  function openCreateForm() {
    setEditingRuleId(null);
    setFormData(EMPTY_FORM);
    setFormMode('create');
  }

  function openEditForm(rule: AutomationRule) {
    setEditingRuleId(rule.id);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      enabled: rule.enabled,
      triggerType: rule.trigger.type,
      actionType: rule.actions[0]?.type || 'assign_issue',
    });
    setFormMode('edit');
  }

  async function saveRule() {
    if (!formData.name.trim()) {
      toast({
        title: t('automation.toast.errorTitle'),
        description: t('automation.toast.nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        organizationId,
        projectId: projectId || null,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        enabled: formData.enabled,
        trigger: { type: formData.triggerType },
        conditions: [],
        actions: [{ type: formData.actionType }],
      };

      const response = await fetch(
        formMode === 'edit' && editingRuleId
          ? `/api/automation-rules/${editingRuleId}`
          : '/api/automation-rules',
        {
          method: formMode === 'edit' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          formMode === 'edit'
            ? t('automation.toast.updateFailed')
            : t('automation.toast.createFailed')
        );
      }

      toast({
        title: t('automation.toast.successTitle'),
        description:
          formMode === 'edit'
            ? t('automation.toast.ruleUpdated')
            : t('automation.toast.ruleCreated'),
      });

      resetForm();
      await fetchRules();
    } catch (error) {
      toast({
        title: t('automation.toast.errorTitle'),
        description: error instanceof Error ? error.message : t('automation.toast.saveFailed'),
        variant: 'destructive',
      });
    }
  }

  async function toggleRule(ruleId: string, currentState: boolean) {
    try {
      const response = await fetch(`/api/automation-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentState }),
      });

      if (!response.ok) throw new Error('Failed to toggle rule');

      toast({
        title: t('automation.toast.successTitle'),
        description: !currentState
          ? t('automation.toast.ruleEnabled')
          : t('automation.toast.ruleDisabled'),
      });

      await fetchRules();
    } catch (error) {
      toast({
        title: t('automation.toast.errorTitle'),
        description: t('automation.toast.toggleFailed'),
        variant: 'destructive',
      });
    }
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm(t('automation.deleteConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`/api/automation-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete rule');

      toast({
        title: t('automation.toast.successTitle'),
        description: t('automation.toast.ruleDeleted'),
      });

      if (editingRuleId === ruleId) {
        resetForm();
      }

      await fetchRules();
    } catch (error) {
      toast({
        title: t('automation.toast.errorTitle'),
        description: t('automation.toast.deleteFailed'),
        variant: 'destructive',
      });
    }
  }

  const fetchExecutions = useCallback(
    async (ruleId: string) => {
      setExecutionsLoading(true);
      setExecutionsError(null);
      try {
        const response = await fetch(`/api/automation-rules/${ruleId}/executions?limit=50`);
        if (!response.ok) {
          throw new Error(t('automation.toast.executionsLoadFailed'));
        }
        const data: AutomationExecution[] = await response.json();
        setExecutions(data);
      } catch (error) {
        setExecutions([]);
        setExecutionsError(
          error instanceof Error ? error.message : t('automation.toast.executionsLoadFailed')
        );
      } finally {
        setExecutionsLoading(false);
      }
    },
    [t]
  );

  function openExecutions(rule: AutomationRule) {
    setExecutionsRule(rule);
    setExecutions([]);
    setExpandedExecutionId(null);
    void fetchExecutions(rule.id);
  }

  function closeExecutions() {
    setExecutionsRule(null);
    setExecutions([]);
    setExpandedExecutionId(null);
    setExecutionsError(null);
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-4 text-sm">{t('automation.loading')}</div>;
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="kicker">{t('automation.kicker')}</span>
          <h3 className="text-foreground text-base font-semibold tracking-tight">
            {t('automation.title')}
          </h3>
          <p className="text-muted-foreground text-sm">{t('automation.subtitle')}</p>
        </div>
        <Button
          onClick={() => (formMode ? resetForm() : openCreateForm())}
          variant={formMode ? 'outline' : 'default'}
        >
          <Plus className="mr-2 h-4 w-4" />
          {formMode ? t('automation.closeEditor') : t('automation.createRule')}
        </Button>
      </div>

      {formMode ? (
        <div className="surface-card animate-fade-up space-y-5 p-5">
          <div className="space-y-1">
            <span className="kicker">
              {formMode === 'edit'
                ? t('automation.form.editKicker')
                : t('automation.form.newKicker')}
            </span>
            <h4 className="text-sm font-semibold tracking-tight">
              {formMode === 'edit'
                ? t('automation.form.editTitle')
                : t('automation.form.createTitle')}
            </h4>
            <p className="text-muted-foreground text-xs">{t('automation.form.description')}</p>
          </div>

          <div className="space-y-5">
            <FormRow
              label={t('automation.form.nameLabel')}
              htmlFor="rule-name"
              description={t('automation.form.nameDescription')}
            >
              <Input
                id="rule-name"
                placeholder={t('automation.form.namePlaceholder')}
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, name: event.target.value }))
                }
              />
            </FormRow>

            <FormRow
              label={t('automation.form.descriptionLabel')}
              htmlFor="rule-description"
              description={t('automation.form.descriptionHint')}
            >
              <Input
                id="rule-description"
                placeholder={t('automation.form.descriptionPlaceholder')}
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, description: event.target.value }))
                }
              />
            </FormRow>

            <div className="surface-inset space-y-5 rounded-md p-4">
              <span className="kicker">{t('automation.form.triggersAndActions')}</span>

              <FormRow
                label={t('automation.form.triggerLabel')}
                htmlFor="trigger-type"
                description={t('automation.form.triggerDescription')}
              >
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) =>
                    setFormData((current) => ({ ...current, triggerType: value }))
                  }
                >
                  <SelectTrigger id="trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(type.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>

              <FormRow
                label={t('automation.form.actionLabel')}
                htmlFor="action-type"
                description={t('automation.form.actionDescription')}
              >
                <Select
                  value={formData.actionType}
                  onValueChange={(value) =>
                    setFormData((current) => ({ ...current, actionType: value }))
                  }
                >
                  <SelectTrigger id="action-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(type.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
            </div>

            <FormRow
              label={t('automation.form.enabledLabel')}
              htmlFor="enabled"
              description={t('automation.form.enabledDescription')}
            >
              <div className="flex h-10 items-center">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({ ...current, enabled: checked }))
                  }
                />
              </div>
            </FormRow>
          </div>

          <div className="border-border/60 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={resetForm}>
              {t('automation.cancel')}
            </Button>
            <Button onClick={() => void saveRule()}>
              {formMode === 'edit' ? t('automation.saveChanges') : t('automation.createRule')}
            </Button>
          </div>
        </div>
      ) : null}

      {rules.length === 0 && !formMode ? (
        <div className="surface-card space-y-3 p-10 text-center">
          <Zap className="text-muted-foreground/50 mx-auto h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t('automation.emptyTitle')}</p>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            {t('automation.createFirst')}
          </Button>
        </div>
      ) : rules.length > 0 ? (
        <div className="surface-card divide-border/60 stagger divide-y">
          {rules.map((rule) => {
            const triggerMeta = TRIGGER_TYPES.find((type) => type.value === rule.trigger.type);
            const triggerLabel = triggerMeta ? t(triggerMeta.labelKey) : rule.trigger.type;

            return (
              <div
                key={rule.id}
                className={`row-interactive flex items-center gap-3 px-4 py-2.5 ${
                  rule.enabled ? '' : 'opacity-60'
                }`}
              >
                <span className="icon-tile icon-tile-accent-violet shrink-0" aria-hidden="true">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  {rule.description ? (
                    <p className="text-muted-foreground truncate text-xs">{rule.description}</p>
                  ) : null}
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                  <span className="chip-violet text-[11px]">{triggerLabel}</span>
                  <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  {rule.actions.slice(0, 1).map((action, index) => {
                    const actionMeta = ACTION_TYPES.find((type) => type.value === action.type);
                    return (
                      <span key={`${action.type}-${index}`} className="chip text-[11px]">
                        {actionMeta ? t(actionMeta.labelKey) : action.type}
                      </span>
                    );
                  })}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => void toggleRule(rule.id, rule.enabled)}
                    aria-label={
                      rule.enabled ? t('automation.disableRule') : t('automation.enableRule')
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openExecutions(rule)}
                    aria-label={t('automation.viewExecutions')}
                    title={t('automation.viewExecutions')}
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openEditForm(rule)}
                    aria-label={t('automation.editRule')}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    onClick={() => void deleteRule(rule.id)}
                    aria-label={t('automation.deleteRule')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={executionsRule !== null}
        onOpenChange={(open) => {
          if (!open) closeExecutions();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="text-muted-foreground h-4 w-4" />
              {t('automation.executions.title')}
              {executionsRule ? (
                <span className="text-muted-foreground truncate text-sm font-normal">
                  · {executionsRule.name}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>{t('automation.executions.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {executionsLoading ? (
              <div className="text-muted-foreground p-6 text-center text-sm">
                {t('automation.executions.loading')}
              </div>
            ) : executionsError ? (
              <div className="surface-inset text-destructive flex items-start gap-2 rounded-md p-4 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{t('automation.executions.loadFailedTitle')}</p>
                  <p className="text-muted-foreground text-xs">{executionsError}</p>
                </div>
              </div>
            ) : executions.length === 0 && executionsRule ? (
              <div className="surface-inset space-y-2 rounded-md p-6 text-center">
                <Zap className="text-muted-foreground/50 mx-auto h-6 w-6" />
                <p className="text-muted-foreground text-sm">
                  {t.rich('automation.executions.empty', {
                    trigger: () => {
                      const meta = TRIGGER_TYPES.find(
                        (type) => type.value === executionsRule.trigger.type
                      );
                      return (
                        <span className="text-foreground font-medium">
                          {meta ? t(meta.labelKey) : executionsRule.trigger.type}
                        </span>
                      );
                    },
                  })}
                </p>
              </div>
            ) : (
              <div className="surface-card divide-border/60 max-h-[60vh] divide-y overflow-y-auto">
                {executions.map((execution) => {
                  const isExpanded = expandedExecutionId === execution.id;
                  return (
                    <div key={execution.id} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => setExpandedExecutionId(isExpanded ? null : execution.id)}
                        className="row-interactive flex items-center gap-3 px-3 py-2.5 text-left"
                        aria-expanded={isExpanded}
                      >
                        <ChevronRight
                          className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {formatTimestamp(execution.triggeredAt)}
                          </p>
                          {execution.error ? (
                            <p className="text-destructive truncate text-xs">{execution.error}</p>
                          ) : null}
                        </div>
                        <Badge variant={executionStatusVariant(execution.status)}>
                          {execution.status}
                        </Badge>
                        <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                          {t('automation.executions.actionCount', {
                            count: executionActionCount(execution.actionResults),
                          })}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {formatDuration(execution.durationMs)}
                        </span>
                      </button>

                      {isExpanded ? (
                        <div className="surface-inset border-border/60 grid gap-3 border-t p-3 text-xs">
                          <div>
                            <p className="kicker mb-1">
                              {t('automation.executions.triggerPayload')}
                            </p>
                            <pre className="bg-background/70 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-snug">
                              {prettyJson(execution.triggerPayload)}
                            </pre>
                          </div>
                          <div>
                            <p className="kicker mb-1">
                              {t('automation.executions.actionResults')}
                            </p>
                            <pre className="bg-background/70 max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px] leading-snug">
                              {prettyJson(execution.actionResults)}
                            </pre>
                          </div>
                          {execution.error ? (
                            <div>
                              <p className="kicker mb-1">{t('automation.executions.error')}</p>
                              <pre className="bg-destructive/5 text-destructive overflow-auto rounded-md p-2 font-mono text-[11px] leading-snug">
                                {execution.error}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
