'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Zap, ArrowRight } from 'lucide-react';

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
                className={`flex items-center gap-4 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/40 ${
                  rule.enabled ? '' : 'opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  {rule.description ? (
                    <p className="truncate text-xs text-muted-foreground">{rule.description}</p>
                  ) : null}
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                  <span className="chip-accent text-[11px]">{triggerLabel}</span>
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
    </div>
  );
}
