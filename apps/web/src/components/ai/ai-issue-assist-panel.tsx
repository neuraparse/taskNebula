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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAiCapability } from '@/lib/hooks/use-ai-capability';
import { AiBadge } from '@/components/ai/AiBadge';

type IssueAssistAction =
  | 'summarize'
  | 'rewrite'
  | 'suggest_next'
  | 'suggest_labels';

interface AiIssueAssistPanelProps {
  issueId: string;
  onApplyDescription?: (text: string) => void;
  onApplyLabels?: (labels: string[]) => void;
}

const ACTIONS: {
  key: IssueAssistAction;
  label: string;
  hint: string;
  icon: typeof BookOpen;
}[] = [
  {
    key: 'summarize',
    label: 'Summarize',
    hint: '3-5 sentence status brief',
    icon: BookOpen,
  },
  {
    key: 'rewrite',
    label: 'Rewrite description',
    hint: 'clearer, same meaning',
    icon: PencilLine,
  },
  {
    key: 'suggest_next',
    label: 'Suggest next steps',
    hint: '3-5 imperative bullets',
    icon: ListTodo,
  },
  {
    key: 'suggest_labels',
    label: 'Suggest labels',
    hint: 'up to 6 kebab-case tags',
    icon: Tag,
  },
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
  const { toast } = useToast();
  const { canDraft } = useAiCapability();
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
    onError: (err: Error) => {
      setActiveAction(null);
      toast({
        title: 'AI assist failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  if (!canDraft) return null;

  function handleCopy() {
    if (!result) return;
    const text =
      result.action === 'suggest_labels' && result.labels
        ? result.labels.join(', ')
        : result.text;
    void navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: 'Copied to clipboard' }))
      .catch(() => toast({ title: 'Copy failed', variant: 'destructive' }));
  }

  const canApplyDescription =
    result?.action === 'rewrite' && typeof onApplyDescription === 'function';
  const canApplyLabels =
    result?.action === 'suggest_labels' &&
    typeof onApplyLabels === 'function' &&
    Array.isArray(result.labels) &&
    result.labels.length > 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          AI assist
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {ACTIONS.map(({ key, label, hint, icon: Icon }) => {
          const loading = activeAction === key && mutation.isPending;
          return (
            <button
              key={key}
              type="button"
              onClick={() => mutation.mutate(key)}
              disabled={mutation.isPending}
              className="group flex flex-col items-start gap-0.5 rounded-md border border-border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3 text-primary" />
                )}
                {label}
              </span>
              <span className="text-[10px] text-muted-foreground">{hint}</span>
            </button>
          );
        })}
      </div>

      {mutation.isError && !result && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{(mutation.error as Error).message}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <AiBadge
                feature={`Issue Assist · ${ACTIONS.find((a) => a.key === result.action)?.label ?? result.action}`}
                model={result.provider}
                generatedAt={new Date()}
              />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
                {ACTIONS.find((a) => a.key === result.action)?.label ?? result.action}
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
                  Apply
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
                  Apply
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
                Copy
              </Button>
            </div>
          </div>

          {result.action === 'suggest_labels' && result.labels?.length ? (
            <div className="flex flex-wrap gap-1">
              {result.labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-xs text-foreground/90">
              {result.text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
