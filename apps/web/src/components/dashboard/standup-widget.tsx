'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Sparkles,
  AlertOctagon,
  Loader2,
  Check,
} from 'lucide-react';
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
    throw new Error(text || 'Failed to generate standup');
  }
  return (await res.json()) as StandupResponse;
}

export function StandupWidget() {
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
      toast({ title: 'Standup generated', description: 'Today\'s digest is ready.' });
    },
    onError: (err) => {
      toast({
        title: 'Could not generate standup',
        description: err instanceof Error ? err.message : 'Unknown error',
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
      toast({ title: 'Copied to clipboard', description: 'Paste into Slack with /tn paste.' });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the text manually instead.',
        variant: 'destructive',
      });
    }
  };

  const hasBlockers = !!(data?.blockersMd && data.blockersMd.trim().length > 0);

  return (
    <div className="surface-card p-4 flex flex-col gap-3 animate-fade-up" data-testid="standup-widget">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-violet" />
          <h3 className="text-sm font-semibold">Today&apos;s standup</h3>
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
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? 'Copied' : 'Copy to Slack'}
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
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {data ? 'Refresh' : 'Generate'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-2" /> Loading…
        </div>
      ) : data ? (
        <div className="flex flex-col gap-2">
          <pre className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed font-sans m-0">
            {data.contentMd}
          </pre>
          {hasBlockers && (
            <div className="mt-2 rounded-md border border-accent-rose/40 bg-accent-rose/5 p-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-rose">
                <AlertOctagon className="h-3 w-3" /> Blockers
              </div>
              <pre className="whitespace-pre-wrap text-xs text-foreground/90 mt-1 m-0 font-sans">
                {data.blockersMd}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No digest yet for today. Click <em>Generate</em> to build one from the last 24h
          of your activity.
        </p>
      )}
    </div>
  );
}
