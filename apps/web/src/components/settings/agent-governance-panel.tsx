'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PolicyRule = {
  actor: string;
  actorKind: 'agent' | 'unknown';
  resource: string;
  action: string;
  effect: 'allow' | 'deny' | 'require_approval';
  approvers?: string[];
  raw: string;
  line: number;
};

type PolicyStatus = {
  enabled: boolean;
  found: boolean;
  sourcePath: string | null;
  parsedAt: string;
  errors: Array<{ line: number; message: string; raw: string }>;
  rules: PolicyRule[];
};

type ApprovalRequest = {
  id: string;
  actor: string;
  resource: string;
  action: string;
  targetType: string;
  targetId: string | null;
  proposedPayload: unknown;
  matchedRule: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: string;
};

function effectLabelKey(effect: PolicyRule['effect']) {
  if (effect === 'allow') return 'agentGovernance.effect.allow';
  if (effect === 'deny') return 'agentGovernance.effect.deny';
  return 'agentGovernance.effect.requireApproval';
}

function effectBadgeClass(effect: PolicyRule['effect']) {
  if (effect === 'allow') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (effect === 'deny') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

export function AgentGovernancePanel({ organizationId }: { organizationId: string }) {
  const t = useTranslations('settingsConfig');
  const queryClient = useQueryClient();

  const policyQuery = useQuery({
    queryKey: ['agent-policy', organizationId],
    queryFn: async () => {
      const response = await fetch(
        `/api/agent-policy?organizationId=${encodeURIComponent(organizationId)}`
      );
      const payload = await response.json().catch(() => ({ error: 'load_failed' }));
      if (!response.ok) throw new Error(payload.error || 'load_failed');
      return payload as PolicyStatus;
    },
  });

  const approvalsQuery = useQuery({
    queryKey: ['agent-approvals', organizationId, 'pending'],
    queryFn: async () => {
      const response = await fetch(
        `/api/agent-approvals?organizationId=${encodeURIComponent(organizationId)}&status=pending`
      );
      const payload = await response.json().catch(() => ({ error: 'load_failed' }));
      if (!response.ok) throw new Error(payload.error || 'load_failed');
      return payload as { approvals: ApprovalRequest[] };
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) => {
      const response = await fetch(`/api/agent-approvals/${id}/${decision}`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({ error: 'decision_failed' }));
      if (!response.ok) throw new Error(payload.error || 'decision_failed');
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-approvals', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });

  const policy = policyQuery.data;
  const approvals = approvalsQuery.data?.approvals ?? [];

  return (
    <Card id="agent-governance" className="border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              {t('agentGovernance.title')}
            </CardTitle>
            <CardDescription>{t('agentGovernance.description')}</CardDescription>
          </div>
          {policy ? (
            <Badge variant={policy.enabled ? 'default' : 'secondary'}>
              {policy.enabled ? t('agentGovernance.enabled') : t('agentGovernance.disabled')}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {policyQuery.isLoading ? (
          <div className="text-muted-foreground text-sm">{t('agentGovernance.loading')}</div>
        ) : policyQuery.error ? (
          <div className="text-destructive text-sm">{t('agentGovernance.loadFailed')}</div>
        ) : policy ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <StatusTile
                label={t('agentGovernance.policySource')}
                value={policy.sourcePath || t('agentGovernance.noPolicy')}
              />
              <StatusTile
                label={t('agentGovernance.lastParsedAt')}
                value={new Date(policy.parsedAt).toLocaleString()}
              />
              <StatusTile
                label={t('agentGovernance.validationErrors')}
                value={String(policy.errors.length)}
                tone={policy.errors.length > 0 ? 'danger' : 'default'}
              />
            </div>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">{t('agentGovernance.behaviorTitle')}</h3>
                <p className="text-muted-foreground text-xs">
                  {t('agentGovernance.behaviorDescription')}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <StatusTile
                  label={t('agentGovernance.unknownAgents')}
                  value={t('agentGovernance.requireApprovalDefault')}
                />
                <StatusTile
                  label={t('agentGovernance.destructiveActions')}
                  value={t('agentGovernance.requireApprovalDefault')}
                />
              </div>
            </section>

            {policy.errors.length > 0 ? (
              <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  {t('agentGovernance.validationTitle')}
                </div>
                <div className="space-y-2">
                  {policy.errors.map((error) => (
                    <div key={`${error.line}-${error.raw}`} className="text-sm">
                      <span className="font-medium">
                        {t('agentGovernance.line', { line: error.line })}
                      </span>{' '}
                      <span className="text-muted-foreground">{error.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">{t('agentGovernance.rulesTitle')}</h3>
                <p className="text-muted-foreground text-xs">
                  {t('agentGovernance.rulesDescription')}
                </p>
              </div>
              {policy.rules.length === 0 ? (
                <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                  {t('agentGovernance.noRules')}
                </div>
              ) : (
                <div className="border-border/60 overflow-hidden rounded-lg border">
                  <div className="bg-muted/30 text-muted-foreground grid grid-cols-[64px_1fr_1fr_120px] gap-3 px-3 py-2 text-xs font-medium">
                    <span>{t('agentGovernance.table.line')}</span>
                    <span>{t('agentGovernance.table.actor')}</span>
                    <span>{t('agentGovernance.table.action')}</span>
                    <span>{t('agentGovernance.table.effect')}</span>
                  </div>
                  {policy.rules.map((rule) => (
                    <div
                      key={`${rule.line}-${rule.raw}`}
                      className="border-border/60 grid grid-cols-[64px_1fr_1fr_120px] gap-3 border-t px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground tabular-nums">{rule.line}</span>
                      <span className="truncate">
                        {rule.actorKind}:{rule.actor}
                      </span>
                      <span className="truncate">
                        {rule.resource}:{rule.action}
                      </span>
                      <span>
                        <Badge className={cn('border-0', effectBadgeClass(rule.effect))}>
                          {t(effectLabelKey(rule.effect))}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">{t('agentGovernance.queueTitle')}</h3>
            <p className="text-muted-foreground text-xs">{t('agentGovernance.queueDescription')}</p>
          </div>
          {approvalsQuery.isLoading ? (
            <div className="text-muted-foreground text-sm">{t('agentGovernance.queueLoading')}</div>
          ) : approvals.length === 0 ? (
            <div className="border-border/60 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              {t('agentGovernance.queueEmpty')}
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((approval) => (
                <div key={approval.id} className="border-border/60 rounded-lg border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{approval.actor}</Badge>
                        <span className="text-sm font-medium">
                          {approval.resource}:{approval.action}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {approval.targetType}
                        {approval.targetId ? ` ${approval.targetId}` : ''}
                      </p>
                      {approval.matchedRule ? (
                        <code className="bg-muted block max-w-full overflow-x-auto rounded-md px-2 py-1 text-xs">
                          {approval.matchedRule}
                        </code>
                      ) : null}
                      <pre className="bg-muted/40 max-h-40 overflow-auto rounded-md p-3 text-xs">
                        {JSON.stringify(approval.proposedPayload, null, 2)}
                      </pre>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          decideMutation.mutate({ id: approval.id, decision: 'approve' })
                        }
                        disabled={decideMutation.isPending}
                      >
                        {decideMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        {t('agentGovernance.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          decideMutation.mutate({ id: approval.id, decision: 'reject' })
                        }
                        disabled={decideMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                        {t('agentGovernance.reject')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function StatusTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="border-border/60 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-sm font-medium',
          tone === 'danger' ? 'text-destructive' : 'text-foreground'
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
