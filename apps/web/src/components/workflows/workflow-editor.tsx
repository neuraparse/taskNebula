'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ArrowRight, Settings as SettingsIcon, Save } from 'lucide-react';

interface WorkflowStatus {
  id: string;
  name: string;
  category: 'backlog' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  color: string;
  position: number;
}

interface WorkflowTransition {
  id: string;
  name: string;
  fromStatusId: string;
  toStatusId: string;
  conditions?: any[];
  validators?: any[];
  postActions?: any[];
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

const STATUS_CATEGORY_COLORS = {
  backlog: '#9CA3AF',
  in_progress: '#3B82F6',
  in_review: '#F59E0B',
  done: '#10B981',
  blocked: '#EF4444',
};

const STATUS_CATEGORY_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  blocked: 'Blocked',
};

interface WorkflowEditorProps {
  organizationId: string;
}

export function WorkflowEditor({ organizationId }: WorkflowEditorProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // New workflow state
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, [organizationId]);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch(`/api/workflows?organizationId=${organizationId}`);
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const data = await response.json();
      setWorkflows(data);
      if (data.length > 0 && !selectedWorkflow) {
        await loadWorkflowDetails(data[0].id);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load workflows',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadWorkflowDetails = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`);
      if (!response.ok) throw new Error('Failed to fetch workflow details');
      const data = await response.json();
      setSelectedWorkflow(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load workflow details',
        variant: 'destructive',
      });
    }
  };

  const createWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      toast({
        title: 'Error',
        description: 'Workflow name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name: newWorkflowName,
          description: newWorkflowDescription,
          statuses: [
            { name: 'To Do', category: 'backlog', color: STATUS_CATEGORY_COLORS.backlog },
            { name: 'In Progress', category: 'in_progress', color: STATUS_CATEGORY_COLORS.in_progress },
            { name: 'Done', category: 'done', color: STATUS_CATEGORY_COLORS.done },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to create workflow');

      toast({
        title: 'Success',
        description: 'Workflow created successfully',
      });

      setNewWorkflowName('');
      setNewWorkflowDescription('');
      fetchWorkflows();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create workflow',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addTransition = async () => {
    if (!selectedWorkflow || selectedWorkflow.statuses.length < 2) {
      toast({
        title: 'Error',
        description: 'Need at least 2 statuses to create a transition',
        variant: 'destructive',
      });
      return;
    }

    const fromStatus = selectedWorkflow.statuses[0];
    const toStatus = selectedWorkflow.statuses[1];

    try {
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${fromStatus.name} → ${toStatus.name}`,
          fromStatusId: fromStatus.id,
          toStatusId: toStatus.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to create transition');

      toast({
        title: 'Success',
        description: 'Transition created',
      });

      loadWorkflowDetails(selectedWorkflow.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create transition',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading workflows...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Workflow Management</h3>
          <p className="text-sm text-muted-foreground">
            Design custom workflows with statuses and transitions
          </p>
        </div>
      </div>

      {/* Create New Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Workflow</CardTitle>
          <CardDescription>
            Define a custom workflow for your projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                placeholder="e.g., Development Workflow"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Input
                id="workflow-description"
                placeholder="Optional description"
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={createWorkflow} disabled={isSaving || !newWorkflowName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </CardContent>
      </Card>

      {/* Existing Workflows */}
      {workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Workflows</CardTitle>
            <CardDescription>
              Select a workflow to view and edit its configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {workflows.map((workflow) => (
                <Button
                  key={workflow.id}
                  variant={selectedWorkflow?.id === workflow.id ? 'default' : 'outline'}
                  onClick={() => loadWorkflowDetails(workflow.id)}
                  className="justify-start h-auto py-3"
                >
                  <div className="flex flex-col items-start gap-1 w-full">
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium">{workflow.name}</span>
                      {workflow.isDefault && (
                        <Badge className="ml-auto" variant="secondary" size="sm">Default</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {workflow.statuses?.length || 0} statuses
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Details */}
      {selectedWorkflow && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedWorkflow.name}</CardTitle>
            <CardDescription>
              {selectedWorkflow.description || 'No description'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Statuses */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Workflow Statuses</h4>
              <div className="flex flex-wrap gap-2">
                {selectedWorkflow.statuses.map((status) => (
                  <Badge
                    key={status.id}
                    style={{ backgroundColor: status.color }}
                    className="text-white px-3 py-1"
                  >
                    <span className="font-medium">{status.name}</span>
                    <span className="mx-1.5">·</span>
                    <span className="text-xs opacity-90">{STATUS_CATEGORY_LABELS[status.category]}</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Transitions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Transitions</h4>
                <Button size="sm" onClick={addTransition} variant="outline">
                  <Plus className="mr-2 h-3 w-3" />
                  Add Transition
                </Button>
              </div>
              {selectedWorkflow.transitions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
                  <p>No transitions defined yet.</p>
                  <p className="text-xs mt-1">Click "Add Transition" to create one.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {selectedWorkflow.transitions.map((transition) => {
                    const fromStatus = selectedWorkflow.statuses.find(
                      (s) => s.id === transition.fromStatusId
                    );
                    const toStatus = selectedWorkflow.statuses.find(
                      (s) => s.id === transition.toStatusId
                    );

                    return (
                      <div
                        key={transition.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        {fromStatus && (
                          <Badge style={{ backgroundColor: fromStatus.color }} className="text-white text-xs">
                            {fromStatus.name}
                          </Badge>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        {toStatus && (
                          <Badge style={{ backgroundColor: toStatus.color }} className="text-white text-xs">
                            {toStatus.name}
                          </Badge>
                        )}
                        <span className="flex-1 text-sm font-medium">{transition.name}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <SettingsIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
