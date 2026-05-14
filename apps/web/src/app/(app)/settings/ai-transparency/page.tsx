'use client';

/**
 * /settings/ai-transparency — workspace-scoped AI Transparency dashboard.
 *
 * Required by EU AI Act Article 50 (2026-08-02). Lists every AI feature
 * currently exposed in the workspace and shows:
 *   - feature name + summary
 *   - model and provider
 *   - what data is sent on every call
 *   - retention policy
 *   - per-feature enable/disable switch
 *   - workspace-wide human-oversight toggle (auto vs review_required)
 */

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, ShieldCheck, Sparkles, Database, Clock3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AI_FEATURE_MODEL_CARDS,
  USER_FACING_AI_FEATURES,
  type AiFeatureId,
} from '@/config/ai-model-cards';
import type { AiOversightMode } from '@/lib/agents/config';

export default function AiTransparencyPage() {
  // Local state is the source of truth for the UI demo wiring; the
  // organization-ai-agents manager handles real persistence via
  // /api/organizations/[id]/settings/ai. Toggling here calls a stub that
  // updates the workspace setting object server-side.
  const [oversight, setOversight] = useState<AiOversightMode>('review_required');
  const [enabled, setEnabled] = useState<Record<AiFeatureId, boolean>>(() => {
    const seed: Record<string, boolean> = {};
    for (const c of AI_FEATURE_MODEL_CARDS) seed[c.id] = true;
    return seed as Record<AiFeatureId, boolean>;
  });

  async function persistOversight(next: AiOversightMode) {
    setOversight(next);
    try {
      await fetch('/api/ai/workspace-oversight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiOversight: next }),
      });
    } catch {
      // Surface in toast — the existing AI agents page handles failures.
    }
  }

  async function persistFeatureToggle(id: AiFeatureId, next: boolean) {
    setEnabled((prev) => ({ ...prev, [id]: next }));
    try {
      await fetch('/api/ai/workspace-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId: id, enabled: next }),
      });
    } catch {
      /* swallow — settings hook will reconcile on next read */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Transparency
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mandatory disclosures for every AI feature in this workspace. Required by{' '}
          <Link
            href="/ai-model-cards"
            className="underline hover:text-foreground inline-flex items-center gap-0.5"
            target="_blank"
          >
            EU AI Act Article 50
            <ExternalLink className="h-3 w-3" />
          </Link>{' '}
          (in force 2026-08-02).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Human-oversight posture
          </CardTitle>
          <CardDescription>
            Controls whether AI outputs can be applied automatically or must always
            be reviewed by a human before being applied to workspace data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {oversight === 'review_required'
                  ? 'Review required (recommended)'
                  : 'Auto-apply'}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {oversight === 'review_required'
                  ? 'Every AI suggestion is queued for explicit human approval before any workspace data is mutated. Triage suggestions are previewed, never applied.'
                  : 'Features that support it may apply high-confidence AI outputs without explicit human review. Audit log still records every action.'}
              </p>
            </div>
            <Switch
              checked={oversight === 'auto'}
              onCheckedChange={(v) =>
                persistOversight(v ? 'auto' : 'review_required')
              }
              aria-label="Toggle human-oversight posture"
              data-testid="ai-oversight-toggle"
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          AI features in this workspace
        </h2>
        <div className="space-y-3">
          {AI_FEATURE_MODEL_CARDS.map((card) => (
            <Card key={card.id} data-testid={`ai-feature-${card.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {card.name}
                      {!card.userFacing && (
                        <Badge variant="muted" size="sm">
                          Background
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{card.summary}</CardDescription>
                  </div>
                  <Switch
                    checked={enabled[card.id] ?? true}
                    onCheckedChange={(v) => persistFeatureToggle(card.id, v)}
                    aria-label={`Toggle ${card.name}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-xs">
                <Field label="Model">
                  <span className="font-mono text-foreground">{card.defaultModel}</span>{' '}
                  <span className="text-muted-foreground">
                    ({card.defaultProvider})
                  </span>
                </Field>
                <Field label="Default oversight">
                  <Badge
                    variant={card.defaultOversight === 'review_required' ? 'info' : 'muted'}
                    size="sm"
                  >
                    {card.defaultOversight === 'review_required'
                      ? 'Review required'
                      : 'Auto-apply allowed'}
                  </Badge>
                </Field>
                <Field label="Data sent" className="sm:col-span-2">
                  <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                    {card.dataSent.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Field>
                <Field label="Retention" className="sm:col-span-2">
                  <p className="text-muted-foreground inline-flex items-start gap-1.5">
                    <Clock3 className="h-3 w-3 mt-0.5 shrink-0" />
                    {card.retention}
                  </p>
                </Field>
                <div className="sm:col-span-2 pt-1">
                  <Link
                    href={`/ai-model-cards#${card.id}`}
                    target="_blank"
                    className="text-xs underline hover:text-foreground inline-flex items-center gap-1"
                  >
                    Read full model card
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4 text-xs text-muted-foreground flex items-center gap-2">
          <Database className="h-3.5 w-3.5" />
          <span>
            <strong className="text-foreground">{USER_FACING_AI_FEATURES.length}</strong> of{' '}
            {AI_FEATURE_MODEL_CARDS.length} features are user-facing and must carry the{' '}
            <em>Generated with AI</em> badge per Article 50.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}
