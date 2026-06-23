'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  BookOpen,
  PencilLine,
  ListTodo,
  Tag,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAiCapability } from '@/lib/hooks/use-ai-capability';
import { AiBadge } from '@/components/ai/AiBadge';

type IssueAssistAction = 'summarize' | 'rewrite' | 'suggest_next' | 'suggest_labels';

interface AiIssueAssistPanelProps {
  issueId: string;
  onApplyDescription?: (text: string) => void;
  onApplyLabels?: (labels: string[]) => void;
}

const ACTIONS: {
  key: IssueAssistAction;
  icon: typeof BookOpen;
}[] = [
  { key: 'summarize', icon: BookOpen },
  { key: 'rewrite', icon: PencilLine },
  { key: 'suggest_next', icon: ListTodo },
  { key: 'suggest_labels', icon: Tag },
];

async function runAssist(
  issueId: string,
  action: IssueAssistAction
): Promise<{ text: string; labels?: string[]; provider: string }> {
  const r = await fetch('/api/ai/issue-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueId, action }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Assist failed (${r.status})`);
  }
  return r.json();
}

export function AiIssueAssistPanel({
  issueId,
  onApplyDescription,
  onApplyLabels,
}: AiIssueAssistPanelProps) {
  const t = useTranslations('aiFeatures');
  const { toast } = useToast();
  const { canDraft } = useAiCapability();
  const actionLabel = (action: IssueAssistAction) => t(`assist.actions.${action}.label`);
  const [activeAction, setActiveAction] = useState<IssueAssistAction | null>(null);
  const [result, setResult] = useState<{
    action: IssueAssistAction;
    text: string;
    labels?: string[];
    provider: string;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: (action: IssueAssistAction) => runAssist(issueId, action),
    onMutate: (action) => setActiveAction(action),
    onSuccess: (data, action) => {
      setResult({ action, ...data });
      setActiveAction(null);
    },
    onError: () => {
      setActiveAction(null);
      toast({
        title: t('assist.assistFailed'),
        description: t('assist.assistFailed'),
        variant: 'destructive',
      });
    },
  });

  if (!canDraft) return null;

  function handleCopy() {
    if (!result) return;
    const text =
      result.action === 'suggest_labels' && result.labels ? result.labels.join(', ') : result.text;
    void navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: t('assist.copied') }))
      .catch(() => toast({ title: t('assist.copyFailed'), variant: 'destructive' }));
  }

  const canApplyDescription =
    result?.action === 'rewrite' && typeof onApplyDescription === 'function';
  const canApplyLabels =
    result?.action === 'suggest_labels' &&
    typeof onApplyLabels === 'function' &&
    Array.isArray(result.labels) &&
    result.labels.length > 0;

  return (
    <div className="border-primary/30 bg-primary/[0.03] space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide">{t('assist.title')}</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {ACTIONS.map(({ key, icon: Icon }) => {
          const loading = activeAction === key && mutation.isPending;
          return (
            <button
              key={key}
              type="button"
              onClick={() => mutation.mutate(key)}
              disabled={mutation.isPending}
              className="border-border bg-background hover:border-primary/40 hover:bg-primary/5 group flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="text-foreground flex items-center gap-1.5 font-medium">
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="text-primary h-3 w-3" />
                )}
                {actionLabel(key)}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {t(`assist.actions.${key}.hint`)}
              </span>
            </button>
          );
        })}
      </div>

      {mutation.isError && !result && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-2 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{(mutation.error as Error).message}</span>
        </div>
      )}

      {result && (
        <div className="border-border bg-background space-y-2 rounded-md border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <AiBadge
                feature={t('assist.featureName', { action: actionLabel(result.action) })}
                model={result.provider}
                generatedAt={new Date()}
              />
              <span className="text-muted-foreground truncate text-[10px] font-medium uppercase tracking-wide">
                {actionLabel(result.action)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {canApplyDescription && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onApplyDescription!(result.text)}
                >
                  {t('assist.apply')}
                </Button>
              )}
              {canApplyLabels && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => onApplyLabels!(result.labels!)}
                >
                  {t('assist.apply')}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={handleCopy}
              >
                <Copy className="mr-1 h-3 w-3" />
                {t('assist.copy')}
              </Button>
            </div>
          </div>

          {result.action === 'suggest_labels' && result.labels?.length ? (
            <div className="flex flex-wrap gap-1">
              {result.labels.map((label) => (
                <span
                  key={label}
                  className="border-border bg-muted/30 rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <pre className="text-foreground/90 whitespace-pre-wrap text-xs">{result.text}</pre>
          )}
        </div>
      )}
    </div>
  );
}
