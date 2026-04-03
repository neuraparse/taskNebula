'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Zap, Play, Pause } from 'lucide-react';

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
          <h3 className="text-lg font-semibold">Automation rules</h3>
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

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData((current) => ({ ...current, enabled: checked }))}
              />
              <Label htmlFor="enabled">Enable immediately</Label>
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

      <div className="grid gap-4">
        {rules.length === 0 && !formMode ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Zap className="mb-4 h-16 w-16 opacity-20" />
              <h4 className="mb-2 font-semibold">No automation rules yet</h4>
              <p className="mb-4 text-sm text-muted-foreground">Create the first rule to automate repetitive handoffs.</p>
              <Button onClick={openCreateForm}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={rule.enabled ? 'border-l-4 border-l-green-500' : 'opacity-70'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    {rule.description ? (
                      <CardDescription>{rule.description}</CardDescription>
                    ) : (
                      <CardDescription>No description provided.</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void toggleRule(rule.id, rule.enabled)}
                      className="h-8 w-8"
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      {rule.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditForm(rule)}
                      className="h-8 w-8"
                      title="Edit"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void deleteRule(rule.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">When:</span>
                    <Badge variant="outline" className="font-normal">
                      {TRIGGER_TYPES.find((type) => type.value === rule.trigger.type)?.label || rule.trigger.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">Then:</span>
                    <div className="flex flex-wrap gap-1">
                      {rule.actions.map((action, index) => (
                        <Badge key={`${action.type}-${index}`} variant="secondary" className="font-normal">
                          {ACTION_TYPES.find((type) => type.value === action.type)?.label || action.type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
