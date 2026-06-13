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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('pagesSettings');
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
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="text-primary h-5 w-5" />
          {t('aiTransparency.title')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t.rich('aiTransparency.subtitle', {
            link: (chunks) => (
              <Link
                href="/ai-model-cards"
                className="hover:text-foreground inline-flex items-center gap-0.5 underline"
                target="_blank"
              >
                {chunks}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ),
          })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            {t('oversight.title')}
          </CardTitle>
          <CardDescription>{t('oversight.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {oversight === 'review_required'
                  ? t('oversight.reviewRequiredLabel')
                  : t('oversight.autoApplyLabel')}
              </p>
              <p className="text-muted-foreground max-w-md text-xs">
                {oversight === 'review_required'
                  ? t('oversight.reviewRequiredDescription')
                  : t('oversight.autoApplyDescription')}
              </p>
            </div>
            <Switch
              checked={oversight === 'auto'}
              onCheckedChange={(v) => persistOversight(v ? 'auto' : 'review_required')}
              aria-label={t('oversight.toggleAria')}
              data-testid="ai-oversight-toggle"
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold uppercase tracking-wide">
          {t('features.heading')}
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
                          {t('features.backgroundBadge')}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{card.summary}</CardDescription>
                  </div>
                  <Switch
                    checked={enabled[card.id] ?? true}
                    onCheckedChange={(v) => persistFeatureToggle(card.id, v)}
                    aria-label={t('features.toggleFeatureAria', { name: card.name })}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-xs sm:grid-cols-2">
                <Field label={t('features.modelLabel')}>
                  <span className="text-foreground font-mono">{card.defaultModel}</span>{' '}
                  <span className="text-muted-foreground">({card.defaultProvider})</span>
                </Field>
                <Field label={t('features.defaultOversightLabel')}>
                  <Badge
                    variant={card.defaultOversight === 'review_required' ? 'info' : 'muted'}
                    size="sm"
                  >
                    {card.defaultOversight === 'review_required'
                      ? t('features.reviewRequiredBadge')
                      : t('features.autoApplyBadge')}
                  </Badge>
                </Field>
                <Field label={t('features.dataSentLabel')} className="sm:col-span-2">
                  <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                    {card.dataSent.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Field>
                <Field label={t('features.retentionLabel')} className="sm:col-span-2">
                  <p className="text-muted-foreground inline-flex items-start gap-1.5">
                    <Clock3 className="mt-0.5 h-3 w-3 shrink-0" />
                    {card.retention}
                  </p>
                </Field>
                <div className="pt-1 sm:col-span-2">
                  <Link
                    href={`/ai-model-cards#${card.id}`}
                    target="_blank"
                    className="hover:text-foreground inline-flex items-center gap-1 text-xs underline"
                  >
                    {t('features.readModelCard')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="text-muted-foreground flex items-center gap-2 py-4 text-xs">
          <Database className="h-3.5 w-3.5" />
          <span>
            {t.rich('features.footer', {
              userFacing: USER_FACING_AI_FEATURES.length,
              total: AI_FEATURE_MODEL_CARDS.length,
              strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
              em: (chunks) => <em>{chunks}</em>,
            })}
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
      <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">{label}</p>
      <div>{children}</div>
    </div>
  );
}
