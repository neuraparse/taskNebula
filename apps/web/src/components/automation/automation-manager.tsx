'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Trash2, Edit, Zap, ArrowRight, History, ChevronRight, AlertCircle } from 'lucide-react';

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
  { value: 'issue_created', label: 'Issue Created' },
  { value: 'issue_updated', label: 'Issue Updated' },
  { value: 'issue_transitioned', label: 'Issue Transitioned' },
  { value: 'issue_assigned', label: 'Issue Assigned' },
  { value: 'issue_commented', label: 'Issue Commented' },
  { value: 'schedule', label: 'Scheduled' },
];

const ACTION_TYPES = [
  { value: 'assign_issue', label: 'Assign Issue' },
  { value: 'transition_issue', label: 'Transition Issue' },
  { value: 'add_comment', label: 'Add Comment' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'send_email', label: 'Send Email' },
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
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
      <div className="space-y-1 pt-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
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
        title: 'Error',
        description: 'Failed to load automation rules',
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
        title: 'Error',
        description: 'Rule name is required',
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
        formMode === 'edit' && editingRuleId ? `/api/automation-rules/${editingRuleId}` : '/api/automation-rules',
        {
          method: formMode === 'edit' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${formMode === 'edit' ? 'update' : 'create'} automation rule`);
      }

      toast({
        title: 'Success',
        description: formMode === 'edit' ? 'Automation rule updated' : 'Automation rule created',
      });

      resetForm();
      await fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save automation rule',
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
        title: 'Success',
        description: `Rule ${!currentState ? 'enabled' : 'disabled'}`,
      });

      await fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle rule',
        variant: 'destructive',
      });
    }
  }

  async function deleteRule(ruleId: string) {
    if (!window.confirm('Are you sure you want to delete this automation rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/automation-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete rule');

      toast({
        title: 'Success',
        description: 'Automation rule deleted',
      });

      if (editingRuleId === ruleId) {
        resetForm();
      }

      await fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  }

  const fetchExecutions = useCallback(async (ruleId: string) => {
    setExecutionsLoading(true);
    setExecutionsError(null);
    try {
      const response = await fetch(`/api/automation-rules/${ruleId}/executions?limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch executions');
      }
      const data: AutomationExecution[] = await response.json();
      setExecutions(data);
    } catch (error) {
      setExecutions([]);
      setExecutionsError(
        error instanceof Error ? error.message : 'Failed to load executions'
      );
    } finally {
      setExecutionsLoading(false);
    }
  }, []);

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
    return <div className="p-4 text-sm text-muted-foreground">Loading automation rules...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="kicker">Automation</span>
          <h3 className="text-base font-semibold tracking-tight text-foreground">Automation rules</h3>
          <p className="text-sm text-muted-foreground">Automate repetitive work with project-specific or organization-wide rules.</p>
        </div>
        <Button
          onClick={() => (formMode ? resetForm() : openCreateForm())}
          variant={formMode ? 'outline' : 'default'}
        >
          <Plus className="mr-2 h-4 w-4" />
          {formMode ? 'Close editor' : 'Create rule'}
        </Button>
      </div>

      {formMode ? (
        <div className="surface-card p-5 space-y-5 animate-fade-up">
          <div className="space-y-1">
            <span className="kicker">{formMode === 'edit' ? 'Edit rule' : 'New rule'}</span>
            <h4 className="text-sm font-semibold tracking-tight">
              {formMode === 'edit' ? 'Edit automation rule' : 'Create automation rule'}
            </h4>
            <p className="text-xs text-muted-foreground">
              Define a trigger and the primary action the rule should perform.
            </p>
          </div>

          <div className="space-y-5">
            <FormRow label="Rule name" htmlFor="rule-name" description="A short name team members will recognize.">
              <Input
                id="rule-name"
                placeholder="Auto-assign new issues"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              />
            </FormRow>

            <FormRow label="Description" htmlFor="rule-description" description="Optional — explain when this rule fires.">
              <Input
                id="rule-description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, description: event.target.value }))
                }
              />
            </FormRow>

            <div className="surface-inset p-4 rounded-md space-y-5">
              <span className="kicker">Triggers and actions</span>

              <FormRow label="Trigger" htmlFor="trigger-type" description="What event starts this rule.">
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) => setFormData((current) => ({ ...current, triggerType: value }))}
                >
                  <SelectTrigger id="trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>

              <FormRow label="Action" htmlFor="action-type" description="What should happen when the rule fires.">
                <Select
                  value={formData.actionType}
                  onValueChange={(value) => setFormData((current) => ({ ...current, actionType: value }))}
                >
                  <SelectTrigger id="action-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
            </div>

            <FormRow label="Enabled" htmlFor="enabled" description="Turn on as soon as saved.">
              <div className="flex h-10 items-center">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData((current) => ({ ...current, enabled: checked }))}
                />
              </div>
            </FormRow>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={() => void saveRule()}>
              {formMode === 'edit' ? 'Save changes' : 'Create rule'}
            </Button>
          </div>
        </div>
      ) : null}

      {rules.length === 0 && !formMode ? (
        <div className="surface-card p-10 text-center space-y-3">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No automation rules yet.</p>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first rule
          </Button>
        </div>
      ) : rules.length > 0 ? (
        <div className="surface-card divide-y divide-border/60 stagger">
          {rules.map((rule) => {
            const triggerLabel = TRIGGER_TYPES.find((t) => t.value === rule.trigger.type)?.label || rule.trigger.type;

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
                    <p className="truncate text-xs text-muted-foreground">{rule.description}</p>
                  ) : null}
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                  <span className="chip-violet text-[11px]">{triggerLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {rule.actions.slice(0, 1).map((action, index) => (
                    <span key={`${action.type}-${index}`} className="chip text-[11px]">
                      {ACTION_TYPES.find((t) => t.value === action.type)?.label || action.type}
                    </span>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => void toggleRule(rule.id, rule.enabled)}
                    aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openExecutions(rule)}
                    aria-label="View executions"
                    title="View executions"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openEditForm(rule)}
                    aria-label="Edit rule"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => void deleteRule(rule.id)}
                    aria-label="Delete rule"
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
              <History className="h-4 w-4 text-muted-foreground" />
              Executions
              {executionsRule ? (
                <span className="text-sm font-normal text-muted-foreground truncate">
                  · {executionsRule.name}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Recent runs of this rule, newest first. Click a row to inspect the trigger payload and
              per-action results.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {executionsLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Loading executions…
              </div>
            ) : executionsError ? (
              <div className="surface-inset flex items-start gap-2 rounded-md p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Couldn&apos;t load executions</p>
                  <p className="text-xs text-muted-foreground">{executionsError}</p>
                </div>
              </div>
            ) : executions.length === 0 && executionsRule ? (
              <div className="surface-inset rounded-md p-6 text-center space-y-2">
                <Zap className="mx-auto h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No executions yet. This rule will run when{' '}
                  <span className="font-medium text-foreground">
                    {TRIGGER_TYPES.find((t) => t.value === executionsRule.trigger.type)?.label ||
                      executionsRule.trigger.type}
                  </span>{' '}
                  events happen on this project.
                </p>
              </div>
            ) : (
              <div className="surface-card divide-y divide-border/60 max-h-[60vh] overflow-y-auto">
                {executions.map((execution) => {
                  const isExpanded = expandedExecutionId === execution.id;
                  return (
                    <div key={execution.id} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedExecutionId(isExpanded ? null : execution.id)
                        }
                        className="row-interactive flex items-center gap-3 px-3 py-2.5 text-left"
                        aria-expanded={isExpanded}
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {formatTimestamp(execution.triggeredAt)}
                          </p>
                          {execution.error ? (
                            <p className="truncate text-xs text-destructive">{execution.error}</p>
                          ) : null}
                        </div>
                        <Badge variant={executionStatusVariant(execution.status)}>
                          {execution.status}
                        </Badge>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                          {executionActionCount(execution.actionResults)}{' '}
                          {executionActionCount(execution.actionResults) === 1
                            ? 'action'
                            : 'actions'}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatDuration(execution.durationMs)}
                        </span>
                      </button>

                      {isExpanded ? (
                        <div className="surface-inset grid gap-3 border-t border-border/60 p-3 text-xs">
                          <div>
                            <p className="kicker mb-1">Trigger payload</p>
                            <pre className="max-h-64 overflow-auto rounded-md bg-background/70 p-2 font-mono text-[11px] leading-snug">
                              {prettyJson(execution.triggerPayload)}
                            </pre>
                          </div>
                          <div>
                            <p className="kicker mb-1">Action results</p>
                            <pre className="max-h-64 overflow-auto rounded-md bg-background/70 p-2 font-mono text-[11px] leading-snug">
                              {prettyJson(execution.actionResults)}
                            </pre>
                          </div>
                          {execution.error ? (
                            <div>
                              <p className="kicker mb-1">Error</p>
                              <pre className="overflow-auto rounded-md bg-destructive/5 p-2 font-mono text-[11px] leading-snug text-destructive">
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
