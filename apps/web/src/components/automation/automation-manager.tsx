'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  conditions: any[];
  actions: any[];
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

export function AutomationManager({ organizationId, projectId }: AutomationManagerProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    triggerType: 'issue_created',
    actionType: 'assign_issue',
  });

  useEffect(() => {
    fetchRules();
  }, [organizationId, projectId]);

  const fetchRules = async () => {
    try {
      let url = `/api/automation-rules?organizationId=${organizationId}`;
      if (projectId) {
        url += `&projectId=${projectId}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch automation rules');
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
  };

  const createRule = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Rule name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          projectId: projectId || null,
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          trigger: { type: formData.triggerType },
          actions: [{ type: formData.actionType }],
        }),
      });

      if (!response.ok) throw new Error('Failed to create automation rule');

      toast({
        title: 'Success',
        description: 'Automation rule created successfully',
      });

      setFormData({
        name: '',
        description: '',
        enabled: true,
        triggerType: 'issue_created',
        actionType: 'assign_issue',
      });
      setShowCreateForm(false);
      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create automation rule',
        variant: 'destructive',
      });
    }
  };

  const toggleRule = async (ruleId: string, currentState: boolean) => {
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

      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle rule',
        variant: 'destructive',
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) {
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

      fetchRules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading automation rules...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Automation Rules</h3>
          <p className="text-sm text-muted-foreground">
            Automate repetitive tasks with custom rules
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} variant={showCreateForm ? 'outline' : 'default'}>
          <Plus className="mr-2 h-4 w-4" />
          {showCreateForm ? 'Cancel' : 'Create Rule'}
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-base">Create Automation Rule</CardTitle>
            <CardDescription>
              Define when and what actions to execute automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  placeholder="e.g., Auto-assign new issues"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-description">Description</Label>
                <Input
                  id="rule-description"
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trigger-type">Trigger</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(value) => setFormData({ ...formData, triggerType: value })}
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
                  onValueChange={(value) => setFormData({ ...formData, actionType: value })}
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
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enable rule immediately</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={createRule}>Create Rule</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <div className="grid gap-4">
        {rules.length === 0 && !showCreateForm ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Zap className="h-16 w-16 mb-4 opacity-20" />
              <h4 className="font-semibold mb-2">No automation rules yet</h4>
              <p className="text-sm text-muted-foreground mb-4">Click "Create Rule" to automate your workflow</p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={rule.enabled ? 'border-l-4 border-l-green-500' : 'opacity-60'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    {rule.description && (
                      <CardDescription className="text-xs">{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleRule(rule.id, rule.enabled)}
                      className="h-8 w-8"
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      {rule.enabled ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteRule(rule.id)}
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
                    <span className="text-muted-foreground font-medium">When:</span>
                    <Badge variant="outline" className="font-normal">
                      {TRIGGER_TYPES.find((t) => t.value === rule.trigger.type)?.label || rule.trigger.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">Then:</span>
                    <div className="flex flex-wrap gap-1">
                      {rule.actions.map((action, idx) => (
                        <Badge key={idx} variant="secondary" className="font-normal">
                          {ACTION_TYPES.find((t) => t.value === action.type)?.label || action.type}
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
