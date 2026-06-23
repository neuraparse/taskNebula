'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
    <div className="text-muted-foreground flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium">
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
    <div className="text-foreground flex items-center gap-2 px-2 py-2 text-xs font-medium">
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

function getCellStatus(
  rule: TransitionRule | undefined,
  fromStateId: string,
  toStateId: string
): CellStatus {
  if (fromStateId === toStateId) {
    return 'self';
  }
  if (!rule) {
    return 'none';
  }
  return rule.requiresApproval ? 'approval' : 'allowed';
}

function CellIcon({
  status,
  labels,
}: {
  status: CellStatus;
  labels: { allowed: string; approval: string; notAllowed: string };
}) {
  if (status === 'self') {
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (status === 'allowed') {
    return <CheckCircle2 className="text-accent-emerald h-4 w-4" aria-label={labels.allowed} />;
  }
  if (status === 'approval') {
    return <ShieldCheck className="text-accent-blue h-4 w-4" aria-label={labels.approval} />;
  }
  return <XCircle className="text-muted-foreground/40 h-4 w-4" aria-label={labels.notAllowed} />;
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

  const t = useTranslations('projectConfig');
  const tActions = useTranslations('actions');
  const tPagesProjects = useTranslations('pagesProjects');
  const { toast } = useToast();
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const cellIconLabels = {
    allowed: t('wf_allowed_transition'),
    approval: t('wf_approval_required'),
    notAllowed: t('wf_not_allowed'),
  };

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
      toast({ title: t('wf_saved_title'), description: t('wf_saved_description') });
    } catch {
      toast({
        title: t('wf_save_failed_title'),
        description: t('wf_save_failed_description'),
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <nav
            aria-label={tPagesProjects('breadcrumb')}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <Link
              href={`/projects/${projectId}/settings`}
              className="hover:text-foreground transition-colors"
            >
              {t('wf_breadcrumb_settings')}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{t('wf_breadcrumb_workflows')}</span>
          </nav>
          <div className="flex items-center gap-2">
            <Workflow className="text-muted-foreground h-5 w-5" aria-hidden="true" />
            <h1 className="text-xl font-semibold tracking-tight">{t('wf_title')}</h1>
          </div>
          <p className="text-muted-foreground text-xs">{t('wf_subtitle')}</p>
        </div>
        <Button onClick={handleSave} type="button" disabled={isSaving || isLoading}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? t('wf_saving') : tActions('save')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Left pane: transition matrix */}
        <Card>
          <CardHeader className="space-y-1 p-5">
            <CardTitle className="text-sm font-semibold">{t('wf_allowed_transitions')}</CardTitle>
            <CardDescription className="text-xs">{t('wf_matrix_help')}</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-border bg-card text-muted-foreground sticky left-0 z-10 border-b px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                      {t('wf_from_to_header')}
                    </th>
                    {states.map((state) => (
                      <th key={state.id} scope="col" className="border-border bg-card border-b">
                        <StateHeaderCell state={state} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {states.map((fromState) => (
                    <tr key={fromState.id} className="border-border/60 border-b last:border-b-0">
                      <th
                        scope="row"
                        className="border-border bg-card sticky left-0 z-10 border-r text-left"
                      >
                        <StateRowLabel state={fromState} />
                      </th>
                      {states.map((toState) => {
                        const rule = findTransition(fromState.id, toState.id);
                        const status = getCellStatus(rule, fromState.id, toState.id);
                        const isSelected = rule?.id === selectedRuleId;
                        const isSelf = fromState.id === toState.id;
                        return (
                          <td key={toState.id} className="p-0 text-center align-middle">
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => handleCellClick(fromState.id, toState.id)}
                              className={[
                                'flex h-10 w-full items-center justify-center border border-transparent transition-colors',
                                isSelf
                                  ? 'bg-muted/30 cursor-not-allowed'
                                  : 'hover:bg-accent/40 focus-visible:ring-ring cursor-pointer focus-visible:outline-none focus-visible:ring-2',
                                isSelected ? 'bg-primary/10 ring-primary/40 ring-1' : '',
                              ].join(' ')}
                              aria-label={
                                isSelf
                                  ? t('wf_cell_self_label', { name: fromState.name })
                                  : t('wf_cell_label', {
                                      from: fromState.name,
                                      to: toState.name,
                                      status,
                                    })
                              }
                              aria-pressed={Boolean(rule)}
                            >
                              <CellIcon status={status} labels={cellIconLabels} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="text-accent-emerald h-3.5 w-3.5" aria-hidden="true" />
                {t('wf_legend_allowed')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="text-accent-blue h-3.5 w-3.5" aria-hidden="true" />
                {t('wf_legend_approval')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="text-muted-foreground/60 h-3.5 w-3.5" aria-hidden="true" />
                {t('wf_legend_not_allowed')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right pane: selected transition details */}
        <Card>
          <CardHeader className="space-y-1 p-5">
            <CardTitle className="text-sm font-semibold">{t('wf_transition_rule')}</CardTitle>
            <CardDescription className="text-xs">
              {selectedRule ? t('wf_transition_rule_selected') : t('wf_transition_rule_none')}
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
              <div className="border-border flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-12 text-center">
                <Workflow className="text-muted-foreground/60 h-6 w-6" aria-hidden="true" />
                <p className="text-muted-foreground text-sm">{t('wf_no_transition_selected')}</p>
                <p className="text-muted-foreground text-xs">{t('wf_no_transition_hint')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default WorkflowBuilder;
