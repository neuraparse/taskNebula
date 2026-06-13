'use client';

/**
 * AiBadge — inline pill that marks any AI-generated output.
 *
 * Required by EU AI Act Article 50 (enforced 2026-08-02): AI outputs intended
 * for consumption by natural persons must carry a machine-readable, visible
 * indicator of their AI origin. The hover tooltip surfaces the model name,
 * the feature that produced the content, and a timestamp so reviewers can
 * trace the run via the AI Transparency settings page / model card.
 *
 * Usage:
 *   <AiBadge feature="Draft Issue" model="Claude Sonnet 4.7" generatedAt={d} />
 *   <AiBadge operationId={id} />   // resolves the rest via useAiTrace()
 */

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAiTrace, type AiTrace } from '@/lib/hooks/use-ai-trace';

export interface AiBadgeProps {
  /** Override label — defaults to "Generated with AI". */
  label?: string;
  /** Human-readable feature name surfaced in the tooltip (e.g. "Draft Issue"). */
  feature?: string;
  /** Model identifier surfaced in the tooltip (e.g. "Claude Sonnet 4.7"). */
  model?: string;
  /** When the output was produced. ISO string or Date. */
  generatedAt?: string | Date | null;
  /** Optional operation id — if provided, metadata is fetched via useAiTrace. */
  operationId?: string;
  /** Optional extra className for layout (e.g. margin). */
  className?: string;
  /** Size variant. `sm` is the default inline pill. */
  size?: 'sm' | 'default';
}

function formatTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Render in ISO-ish local style: YYYY-MM-DD HH:MM
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function buildTooltipText(
  args: {
    model?: string;
    feature?: string;
    generatedAt?: string | Date | null;
  },
  fallback: string
): string {
  const parts: string[] = [];
  if (args.model) parts.push(args.model);
  if (args.feature) parts.push(args.feature);
  const ts = formatTimestamp(args.generatedAt);
  if (ts) parts.push(ts);
  if (parts.length === 0) return fallback;
  return parts.join(' · ');
}

export function AiBadge({
  label,
  feature,
  model,
  generatedAt,
  operationId,
  className,
  size = 'sm',
}: AiBadgeProps) {
  const t = useTranslations('aiFeatures');
  const resolvedLabel = label ?? t('badge.generatedWithAi');
  // When operationId is given the hook resolves model + feature + timestamp.
  const trace: AiTrace | null = useAiTrace(operationId);
  const resolvedModel = model ?? trace?.model;
  const resolvedFeature = feature ?? trace?.feature;
  const resolvedAt = generatedAt ?? trace?.generatedAt ?? null;

  const tooltip = buildTooltipText(
    {
      model: resolvedModel,
      feature: resolvedFeature,
      generatedAt: resolvedAt,
    },
    t('badge.generatedWithAi')
  );

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid="ai-badge"
            data-ai-generated="true"
            aria-label={t('badge.ariaLabel', { detail: tooltip })}
            className={cn('inline-flex', className)}
          >
            <Badge
              variant="info"
              size={size === 'default' ? 'default' : 'sm'}
              className="cursor-help select-none"
            >
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              <span>{resolvedLabel}</span>
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-0.5">
            <p className="font-medium">{t('badge.tooltipTitle')}</p>
            <p className="text-muted-foreground">{tooltip}</p>
            <p className="text-muted-foreground/80 pt-0.5 text-[10px]">
              {t.rich('badge.disclosure', {
                link: (chunks) => (
                  <a
                    href="/ai-model-cards"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-foreground underline"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AiBadge;
