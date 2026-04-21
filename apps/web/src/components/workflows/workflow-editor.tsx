'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ArrowRight, Save, Star, GitBranch } from 'lucide-react';
import { useProject, useUpdateProject } from '@/lib/hooks/use-projects';

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
  conditions?: Array<Record<string, unknown>>;
  validators?: Array<Record<string, unknown>>;
  postActions?: Array<Record<string, unknown>>;
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
  backlog: '#6b7280',
  in_progress: '#3b82f6',
  in_review: '#f59e0b',
  done: '#10b981',
  blocked: '#ef4444',
};

const STATUS_CATEGORY_LABELS = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  blocked: 'Blocked',
};

// Map status category to design token classes
const STATUS_CATEGORY_TOKEN: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground border border-border',
  in_progress: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
  in_review: 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20',
  done: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
  blocked: 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20',
};

function StatusChip({ status }: { status: WorkflowStatus }) {
  const tokenClass = STATUS_CATEGORY_TOKEN[status.category] || 'bg-muted text-muted-foreground border border-border';
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${tokenClass}`}>
      {status.name}
    </span>
  );
}

// Two-column label + control
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

interface WorkflowEditorProps {
  organizationId: string;
  projectId?: string;
}

export function WorkflowEditor({ organizationId, projectId }: WorkflowEditorProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [workflowDraft, setWorkflowDraft] = useState({ name: '', description: '' });
  const [statusForm, setStatusForm] = useState({
    name: '',
    category: 'backlog',
    color: STATUS_CATEGORY_COLORS.backlog,
  });
  const [transitionForm, setTransitionForm] = useState({
    name: '',
    fromStatusId: '',
    toStatusId: '',
  });
  const { toast } = useToast();
  const { data: project } = useProject(projectId || '');
  const updateProject = useUpdateProject();

  useEffect(() => {
    void fetchWorkflows();
  }, [organizationId]);

  useEffect(() => {
    if (!selectedWorkflow) {
      return;
    }

    setWorkflowDraft({
      name: selectedWorkflow.name,
      description: selectedWorkflow.description || '',
    });
    setTransitionForm({
      name: '',
      fromStatusId: selectedWorkflow.statuses[0]?.id || '',
      toStatusId: selectedWorkflow.statuses[1]?.id || selectedWorkflow.statuses[0]?.id || '',
    });
  }, [selectedWorkflow]);

  async function fetchWorkflows() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/workflows?organizationId=${organizationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      setWorkflows(data);

      const preferredWorkflowId = selectedWorkflow?.id || project?.defaultWorkflowId || data[0]?.id;
      if (preferredWorkflowId) {
        await loadWorkflowDetails(preferredWorkflowId);
      } else {
        setSelectedWorkflow(null);
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
  }

  async function loadWorkflowDetails(workflowId: string) {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workflow details');
      }

      const data = await response.json();
      setSelectedWorkflow(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load workflow details',
        variant: 'destructive',
      });
    }
  }

  async function createWorkflow() {
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
          name: newWorkflowName.trim(),
          description: newWorkflowDescription.trim() || null,
          statuses: [
            { name: 'To Do', category: 'backlog', color: STATUS_CATEGORY_COLORS.backlog },
            { name: 'In Progress', category: 'in_progress', color: STATUS_CATEGORY_COLORS.in_progress },
            { name: 'Done', category: 'done', color: STATUS_CATEGORY_COLORS.done },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to create workflow');

      const workflow = await response.json();

      toast({
        title: 'Success',
        description: 'Workflow created successfully',
      });

      setNewWorkflowName('');
      setNewWorkflowDescription('');
      await fetchWorkflows();
      await loadWorkflowDetails(workflow.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create workflow',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveWorkflowMeta() {
    if (!selectedWorkflow) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowDraft.name.trim(),
          description: workflowDraft.description.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow');
      }

      toast({
        title: 'Workflow updated',
        description: 'Workflow name and description were saved.',
      });

      await fetchWorkflows();
      await loadWorkflowDetails(selectedWorkflow.id);
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to update workflow',
        variant: 'destructive',
      });
    }
  }

  async function setWorkflowAsDefault(workflowId: string) {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default workflow');
      }

      toast({
        title: 'Default updated',
        description: 'Organization default workflow changed.',
      });

      await fetchWorkflows();
      await loadWorkflowDetails(workflowId);
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update workflow',
        variant: 'destructive',
      });
    }
  }

  async function deleteWorkflow(workflowId: string) {
    if (!window.confirm('Delete this workflow? Default workflows cannot be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete workflow' }));
        throw new Error(error.error || 'Failed to delete workflow');
      }

      toast({
        title: 'Workflow deleted',
        description: 'The workflow was removed successfully.',
      });

      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
      }

      await fetchWorkflows();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete workflow',
        variant: 'destructive',
      });
    }
  }

  async function assignWorkflowToProject(workflowId: string) {
    if (!projectId) {
      return;
    }

    try {
      await updateProject.mutateAsync({
        projectId,
        data: {
          defaultWorkflowId: workflowId,
        },
      });

      toast({
        title: 'Project workflow updated',
        description: 'This project will now use the selected workflow.',
      });
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description: error instanceof Error ? error.message : 'Failed to assign workflow',
        variant: 'destructive',
      });
    }
  }

  async function addStatus() {
    if (!selectedWorkflow || !statusForm.name.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: statusForm.name.trim(),
          category: statusForm.category,
          color: statusForm.color,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workflow status');
      }

      toast({
        title: 'Status added',
        description: 'Workflow status created successfully.',
      });

      setStatusForm({
        name: '',
        category: 'backlog',
        color: STATUS_CATEGORY_COLORS.backlog,
      });
      await fetchWorkflows();
      await loadWorkflowDetails(selectedWorkflow.id);
    } catch (error) {
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Failed to create workflow status',
        variant: 'destructive',
      });
    }
  }

  async function addTransition() {
    if (!selectedWorkflow || !transitionForm.fromStatusId || !transitionForm.toStatusId) {
      toast({
        title: 'Error',
        description: 'Select both a source and target status.',
        variant: 'destructive',
      });
      return;
    }

    const fromStatus = selectedWorkflow.statuses.find((status) => status.id === transitionForm.fromStatusId);
    const toStatus = selectedWorkflow.statuses.find((status) => status.id === transitionForm.toStatusId);

    try {
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:
            transitionForm.name.trim() ||
            `${fromStatus?.name || 'From'} → ${toStatus?.name || 'To'}`,
          fromStatusId: transitionForm.fromStatusId,
          toStatusId: transitionForm.toStatusId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create transition');

      toast({
        title: 'Transition created',
        description: 'Workflow transition added successfully.',
      });

      setTransitionForm((current) => ({
        ...current,
        name: '',
      }));
      await loadWorkflowDetails(selectedWorkflow.id);
      await fetchWorkflows();
    } catch (error) {
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Failed to create transition',
        variant: 'destructive',
      });
    }
  }

  async function deleteTransition(transitionId: string) {
    if (!selectedWorkflow) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}/transitions/${transitionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transition');
      }

      toast({
        title: 'Transition deleted',
        description: 'Workflow transition removed successfully.',
      });

      await loadWorkflowDetails(selectedWorkflow.id);
      await fetchWorkflows();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete transition',
        variant: 'destructive',
      });
    }
  }

  const hasWorkflowMetaChanges =
    workflowDraft.name !== (selectedWorkflow?.name || '') ||
    workflowDraft.description !== (selectedWorkflow?.description || '');

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading workflows...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {projectId ? (
        <div className="surface-card p-5 space-y-4">
          <div className="space-y-1">
            <span className="kicker">Project workflow</span>
            <h3 className="text-sm font-semibold tracking-tight">Project workflow</h3>
            <p className="text-xs text-muted-foreground">
              Choose which workflow this project should use for issue statuses and transitions.
            </p>
          </div>
          <FormRow
            label="Active workflow"
            description="Changing this updates statuses across the board and issue views."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="text-sm font-medium">
                {workflows.find((workflow) => workflow.id === project?.defaultWorkflowId)?.name || 'No workflow assigned'}
              </div>
              <div className="sm:ml-auto sm:w-[240px]">
                <Select
                  value={project?.defaultWorkflowId || selectedWorkflow?.id || ''}
                  onValueChange={(value) => void assignWorkflowToProject(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormRow>
        </div>
      ) : null}

      <div className="surface-card p-5 space-y-5">
        <div className="space-y-1">
          <span className="kicker">Create</span>
          <h3 className="text-sm font-semibold tracking-tight">Create workflow</h3>
          <p className="text-xs text-muted-foreground">
            Start a new workflow with a simple To Do &rarr; In Progress &rarr; Done flow.
          </p>
        </div>

        <FormRow label="Workflow name" htmlFor="workflow-name">
          <Input
            id="workflow-name"
            placeholder="Development workflow"
            value={newWorkflowName}
            onChange={(event) => setNewWorkflowName(event.target.value)}
          />
        </FormRow>
        <FormRow label="Description" htmlFor="workflow-description" description="Optional — who uses this workflow.">
          <Input
            id="workflow-description"
            placeholder="Optional description"
            value={newWorkflowDescription}
            onChange={(event) => setNewWorkflowDescription(event.target.value)}
          />
        </FormRow>

        <div className="flex justify-end">
          <Button onClick={() => void createWorkflow()} disabled={isSaving || !newWorkflowName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Create workflow
          </Button>
        </div>
      </div>

      {workflows.length > 0 ? (
        <div className="surface-card p-5 space-y-4">
          <div className="space-y-1">
            <span className="kicker">Library</span>
            <h3 className="text-sm font-semibold tracking-tight">Workflows</h3>
            <p className="text-xs text-muted-foreground">Select a workflow to manage its statuses and transitions.</p>
          </div>

          <div className="grid gap-2 stagger sm:grid-cols-2 xl:grid-cols-3">
            {workflows.map((workflow) => (
              <Button
                key={workflow.id}
                variant={selectedWorkflow?.id === workflow.id ? 'default' : 'outline'}
                onClick={() => void loadWorkflowDetails(workflow.id)}
                className="h-auto justify-start rounded-md py-3"
              >
                <div className="flex w-full items-center gap-2.5">
                  <span className="icon-tile icon-tile-accent-violet shrink-0">
                    <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <div className="flex w-full items-center gap-2">
                      <span className="truncate font-medium">{workflow.name}</span>
                      {workflow.isDefault ? <span className="chip ml-auto">Default</span> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {workflow.statuses?.length || 0} statuses
                    </span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedWorkflow ? (
        <div className="surface-card p-5 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="kicker">Details</span>
              <h3 className="text-sm font-semibold tracking-tight">Workflow details</h3>
              <p className="text-xs text-muted-foreground">Update metadata, add statuses, and manage transitions.</p>
            </div>
            <div className="flex items-center gap-2">
              {!selectedWorkflow.isDefault ? (
                <Button variant="outline" size="sm" onClick={() => void setWorkflowAsDefault(selectedWorkflow.id)}>
                  <Star className="mr-2 h-4 w-4" />
                  Make default
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void deleteWorkflow(selectedWorkflow.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          <FormRow label="Name" description="Shown wherever this workflow is referenced.">
            <Input
              value={workflowDraft.name}
              onChange={(event) => setWorkflowDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </FormRow>
          <FormRow label="Description" description="Optional — what this workflow is for.">
            <Textarea
              rows={3}
              value={workflowDraft.description}
              onChange={(event) =>
                setWorkflowDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
          </FormRow>

          <div className="flex justify-end">
            <Button
              onClick={() => void saveWorkflowMeta()}
              disabled={!hasWorkflowMetaChanges || !workflowDraft.name.trim()}
            >
              <Save className="mr-2 h-4 w-4" />
              Save workflow
            </Button>
          </div>

          {/* Statuses */}
          <div className="surface-inset p-4 rounded-md space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="kicker">Statuses</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedWorkflow.statuses.map((status) => (
                  <StatusChip key={status.id} status={status} />
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
              <Input
                placeholder="New status name"
                value={statusForm.name}
                onChange={(event) => setStatusForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Select
                value={statusForm.category}
                onValueChange={(value: WorkflowStatus['category']) =>
                  setStatusForm((current) => ({
                    ...current,
                    category: value,
                    color: STATUS_CATEGORY_COLORS[value],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="color"
                value={statusForm.color}
                onChange={(event) => setStatusForm((current) => ({ ...current, color: event.target.value }))}
                className="h-10 w-full"
                aria-label="Status color"
              />
              <Button onClick={() => void addStatus()} disabled={!statusForm.name.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Transitions */}
          <div className="surface-inset p-4 rounded-md space-y-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="kicker">Transitions</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Transition name (optional)"
                value={transitionForm.name}
                onChange={(event) => setTransitionForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Select
                value={transitionForm.fromStatusId}
                onValueChange={(value) => setTransitionForm((current) => ({ ...current, fromStatusId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="From status" />
                </SelectTrigger>
                <SelectContent>
                  {selectedWorkflow.statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={transitionForm.toStatusId}
                onValueChange={(value) => setTransitionForm((current) => ({ ...current, toStatusId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="To status" />
                </SelectTrigger>
                <SelectContent>
                  {selectedWorkflow.statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => void addTransition()}
                disabled={!transitionForm.fromStatusId || !transitionForm.toStatusId}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add transition
              </Button>
            </div>

            {selectedWorkflow.transitions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No transitions defined yet.
              </div>
            ) : (
              <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-card">
                {selectedWorkflow.transitions.map((transition) => {
                  const fromStatus = selectedWorkflow.statuses.find((status) => status.id === transition.fromStatusId);
                  const toStatus = selectedWorkflow.statuses.find((status) => status.id === transition.toStatusId);

                  return (
                    <div
                      key={transition.id}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-accent/40"
                    >
                      {fromStatus ? <StatusChip status={fromStatus} /> : null}
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {toStatus ? <StatusChip status={toStatus} /> : null}
                      <span className="flex-1 truncate text-sm text-muted-foreground">{transition.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => void deleteTransition(transition.id)}
                        aria-label="Delete transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
