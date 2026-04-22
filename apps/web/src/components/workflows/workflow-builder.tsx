'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, ShieldCheck, Workflow, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TransitionRuleRow } from '@/components/workflows/transition-rule-row';
import { useToast } from '@/hooks/use-toast';
import {
  useWorkflowBuilder,
  type ProjectState,
  type TransitionRule,
} from '@/lib/workflows/use-workflow-builder';

export interface WorkflowBuilderProps {
  projectId: string;
}

function StateHeaderCell({ state }: { state: ProjectState }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: `var(--color-${state.color}-500, currentColor)` }}
      />
      <span className="max-w-[90px] truncate text-center" title={state.name}>
        {state.name}
      </span>
    </div>
  );
}

function StateRowLabel({ state }: { state: ProjectState }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-foreground">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: `var(--color-${state.color}-500, currentColor)` }}
      />
      <span className="truncate" title={state.name}>
        {state.name}
      </span>
    </div>
  );
}

type CellStatus = 'none' | 'allowed' | 'approval' | 'self';

function getCellStatus(rule: TransitionRule | undefined, fromStateId: string, toStateId: string): CellStatus {
  if (fromStateId === toStateId) {
    return 'self';
  }
  if (!rule) {
    return 'none';
  }
  return rule.requiresApproval ? 'approval' : 'allowed';
}

function CellIcon({ status }: { status: CellStatus }) {
  if (status === 'self') {
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (status === 'allowed') {
    return <CheckCircle2 className="h-4 w-4 text-accent-emerald" aria-label="Allowed transition" />;
  }
  if (status === 'approval') {
    return <ShieldCheck className="h-4 w-4 text-accent-blue" aria-label="Approval required" />;
  }
  return <XCircle className="h-4 w-4 text-muted-foreground/40" aria-label="Not allowed" />;
}

export function WorkflowBuilder({ projectId }: WorkflowBuilderProps) {
  const {
    states,
    transitions,
    isLoading,
    isSaving,
    findTransition,
    addTransition,
    updateTransition,
    removeTransition,
    save,
  } = useWorkflowBuilder(projectId);

  const { toast } = useToast();
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const selectedRule = useMemo(
    () => transitions.find((rule) => rule.id === selectedRuleId) ?? null,
    [transitions, selectedRuleId]
  );

  function handleCellClick(fromStateId: string, toStateId: string) {
    if (fromStateId === toStateId) {
      return;
    }
    const existing = findTransition(fromStateId, toStateId);
    if (!existing) {
      const createdId = addTransition(fromStateId, toStateId);
      setSelectedRuleId(createdId);
      return;
    }
    // If already the selected rule, toggle it off (remove); otherwise open it.
    if (selectedRuleId === existing.id) {
      removeTransition(existing.id);
      setSelectedRuleId(null);
      return;
    }
    setSelectedRuleId(existing.id);
  }

  async function handleSave() {
    try {
      await save();
      toast({ title: 'Workflow saved', description: 'Transition rules updated.' });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unable to save transitions.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href={`/projects/${projectId}/settings`}
              className="transition-colors hover:text-foreground"
            >
              Settings
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">Workflows</span>
          </nav>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold tracking-tight">Workflow &amp; Approvals</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Define which state transitions are allowed, who can perform them, and whether approval is required.
          </p>
        </div>
        <Button onClick={handleSave} type="button" disabled={isSaving || isLoading}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Left pane: transition matrix */}
        <Card>
          <CardHeader className="space-y-1 p-5">
            <CardTitle className="text-sm font-semibold">Allowed transitions</CardTitle>
            <CardDescription className="text-xs">
              Rows are the current (from) state, columns are the target (to) state. Click a cell to enable a
              transition; click it again while selected to remove it.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-border bg-card px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      From \ To
                    </th>
                    {states.map((state) => (
                      <th
                        key={state.id}
                        scope="col"
                        className="border-b border-border bg-card"
                      >
                        <StateHeaderCell state={state} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {states.map((fromState) => (
                    <tr key={fromState.id} className="border-b border-border/60 last:border-b-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-r border-border bg-card text-left"
                      >
                        <StateRowLabel state={fromState} />
                      </th>
                      {states.map((toState) => {
                        const rule = findTransition(fromState.id, toState.id);
                        const status = getCellStatus(rule, fromState.id, toState.id);
                        const isSelected = rule?.id === selectedRuleId;
                        const isSelf = fromState.id === toState.id;
                        return (
                          <td
                            key={toState.id}
                            className="p-0 text-center align-middle"
                          >
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleCellClick(fromState.id, toState.id)}
                              className={[
                                'flex h-10 w-full items-center justify-center border border-transparent transition-colors',
                                isSelf
                                  ? 'cursor-not-allowed bg-muted/30'
                                  : 'cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isSelected ? 'bg-primary/10 ring-1 ring-primary/40' : '',
                              ].join(' ')}
                              aria-label={
                                isSelf
                                  ? `${fromState.name} to itself (not applicable)`
                                  : `Transition from ${fromState.name} to ${toState.name} (${status})`
                              }
                              aria-pressed={Boolean(rule)}
                            >
                              <CellIcon status={status} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent-emerald" aria-hidden="true" />
                Allowed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-blue" aria-hidden="true" />
                Approval required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
                Not allowed
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right pane: selected transition details */}
        <Card>
          <CardHeader className="space-y-1 p-5">
            <CardTitle className="text-sm font-semibold">Transition rule</CardTitle>
            <CardDescription className="text-xs">
              {selectedRule
                ? 'Configure who can run this transition and its approval requirements.'
                : 'Select a transition from the matrix to configure its rules.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {selectedRule ? (
              <TransitionRuleRow
                rule={selectedRule}
                states={states}
                onChange={(next) => {
                  const { id, ...patch } = next;
                  updateTransition(id, patch);
                }}
                onRemove={() => {
                  removeTransition(selectedRule.id);
                  setSelectedRuleId(null);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-12 text-center">
                <Workflow className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No transition selected.</p>
                <p className="text-xs text-muted-foreground">
                  Click an empty cell to create one, or an existing one to edit.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default WorkflowBuilder;
