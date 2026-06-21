'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Sparkles, AlertOctagon, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface StandupResponse {
  id: string;
  date: string;
  contentMd: string;
  blockersMd: string;
  createdAt: string;
}

async function fetchTodayStandup(): Promise<StandupResponse | null> {
  const res = await fetch('/api/users/me/standup/today', { cache: 'no-store' });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error('Failed to load standup');
  return (await res.json()) as StandupResponse;
}

async function generatePreview(): Promise<StandupResponse> {
  const res = await fetch('/api/users/me/standup/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Throw any server-provided message verbatim; an empty message lets the
    // caller fall back to a localized generic error instead of hardcoded English.
    throw new Error(text);
  }
  return (await res.json()) as StandupResponse;
}

export function StandupWidget() {
  const t = useTranslations('dashboardExtra');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<StandupResponse | null>({
    queryKey: ['standup', 'today'],
    queryFn: fetchTodayStandup,
    staleTime: 60_000,
  });

  const previewMutation = useMutation({
    mutationFn: generatePreview,
    onSuccess: (next) => {
      queryClient.setQueryData(['standup', 'today'], next);
      toast({ title: t('standup.generated_title'), description: t('standup.generated_desc') });
    },
    onError: (err) => {
      toast({
        title: t('standup.generate_error_title'),
        description: err instanceof Error && err.message ? err.message : t('standup.unknown_error'),
        variant: 'destructive',
      });
    },
  });

  const onCopy = async () => {
    if (!data?.contentMd) return;
    try {
      await navigator.clipboard.writeText(data.contentMd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: t('standup.copied_title'), description: t('standup.copied_desc') });
    } catch {
      toast({
        title: t('standup.copy_failed_title'),
        description: t('standup.copy_failed_desc'),
        variant: 'destructive',
      });
    }
  };

  const hasBlockers = !!(data?.blockersMd && data.blockersMd.trim().length > 0);

  return (
    <div
      className="surface-card animate-fade-up flex flex-col gap-3 p-4"
      data-testid="standup-widget"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-tile icon-tile-accent-violet h-7 w-7">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold">{t('standup.heading')}</h3>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
              className="h-7 px-2 text-xs"
              data-testid="standup-copy"
            >
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? t('standup.copied') : t('standup.copy_to_slack')}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
            className="h-7 px-2 text-xs"
            data-testid="standup-refresh"
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" />
            )}
            {data ? t('standup.refresh') : t('standup.generate')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center text-xs">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" /> {t('standup.loading')}
        </div>
      ) : data ? (
        <div className="flex flex-col gap-2">
          <pre className="text-foreground/90 m-0 whitespace-pre-wrap font-sans text-xs leading-relaxed">
            {data.contentMd}
          </pre>
          {hasBlockers && (
            <div className="border-accent-rose/40 bg-accent-rose/5 mt-2 rounded-md border p-2">
              <div className="text-accent-rose flex items-center gap-1.5 text-xs font-semibold">
                <AlertOctagon className="h-3 w-3" /> {t('standup.blockers')}
              </div>
              <pre className="text-foreground/90 m-0 mt-1 whitespace-pre-wrap font-sans text-xs">
                {data.blockersMd}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t.rich('standup.empty', {
            em: (chunks) => <em>{chunks}</em>,
          })}
        </p>
      )}
    </div>
  );
}
