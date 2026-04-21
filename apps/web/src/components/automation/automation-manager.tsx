'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Automation rules</h3>
          <p className="text-sm text-muted-foreground">Automate repetitive work with project-specific or organization-wide rules.</p>
        </div>
        <Button onClick={() => (formMode ? resetForm() : openCreateForm())} variant={formMode ? 'outline' : 'default'}>
          <Plus className="mr-2 h-4 w-4" />
          {formMode ? 'Close editor' : 'Create rule'}
        </Button>
      </div>

      {formMode ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">
              {formMode === 'edit' ? 'Edit automation rule' : 'Create automation rule'}
            </CardTitle>
            <CardDescription>Define a trigger and the primary action the rule should perform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule name</Label>
                <Input
                  id="rule-name"
                  placeholder="Auto-assign new issues"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-description">Description</Label>
                <Input
                  id="rule-description"
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trigger-type">Trigger</Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="action-type">Action</Label>
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
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData((current) => ({ ...current, enabled: checked }))}
              />
              <Label htmlFor="enabled" className="cursor-pointer">Enable immediately</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => void saveRule()}>
                {formMode === 'edit' ? 'Save changes' : 'Create rule'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {rules.length === 0 && !formMode ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Zap className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
            <p className="font-medium">No automation rules yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create the first rule to automate repetitive handoffs.</p>
            <Button className="mt-4" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first rule
            </Button>
          </div>
        ) : (
          rules.map((rule) => {
            const triggerLabel = TRIGGER_TYPES.find((t) => t.value === rule.trigger.type)?.label || rule.trigger.type;

            return (
              <Card
                key={rule.id}
                className={rule.enabled ? 'border-l-2 border-l-accent-emerald' : 'opacity-60'}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Trigger → Action flow */}
                  <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{rule.name}</p>
                      {rule.description && (
                        <p className="truncate text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <span className="chip-accent text-xs">{triggerLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {rule.actions.map((action, index) => (
                        <span key={`${action.type}-${index}`} className="chip text-xs">
                          {ACTION_TYPES.find((t) => t.value === action.type)?.label || action.type}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Enabled switch + actions */}
                  <div className="flex shrink-0 items-center gap-2 border-l border-border pl-4">
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
                      title="Edit"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => void deleteRule(rule.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
