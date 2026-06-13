'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRefreshVersionInfo, useVersionInfo } from '@/lib/hooks/use-version-info';
import { ArrowUpCircle, Check, ExternalLink, Loader2, RefreshCw, Rocket } from 'lucide-react';

const UPDATE_COMMANDS = 'docker compose pull\ndocker compose up -d web';

function formatVersion(version: string) {
  return `v${version.replace(/^v/, '')}`;
}

// Release URLs come from the GitHub API via our backend; render only https links.
function isHttpsUrl(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

export function VersionPanel() {
  const t = useTranslations('adminUpdates');
  const { toast } = useToast();
  const { data, isLoading, error } = useVersionInfo();
  const refresh = useRefreshVersionInfo();

  function handleCheckNow() {
    refresh.mutate(undefined, {
      onSuccess: (info) => {
        if (info.updateAvailable && info.latest) {
          toast({
            title: t('statusUpdateAvailable'),
            description: t('toastUpdateAvailable', { version: formatVersion(info.latest) }),
          });
        } else if (info.latest) {
          toast({ title: t('statusUpToDate'), description: t('toastUpToDate') });
        } else {
          toast({ title: t('checkFailedTitle'), description: t('checkFailedDescription') });
        }
      },
      onError: (err: Error) => {
        toast({ title: t('checkFailedTitle'), description: err.message, variant: 'destructive' });
      },
    });
  }

  return (
    <div className="surface-card space-y-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Rocket className="text-muted-foreground h-4 w-4" />
            <h3 className="text-sm font-semibold">{t('title')}</h3>
          </div>
          <p className="text-muted-foreground max-w-prose text-xs">{t('description')}</p>
        </div>
        {data ? <StatusChip info={data} /> : null}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : t('loadError')}
        </p>
      ) : data ? (
        <>
          {/* Version summary */}
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('currentVersion')}</dt>
              <dd>
                <span className="chip font-mono text-[11px]">{formatVersion(data.current)}</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('latestVersion')}</dt>
              <dd className="flex items-center gap-2">
                {data.latest ? (
                  <span className="chip font-mono text-[11px]">{formatVersion(data.latest)}</span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
                {data.publishedAt ? (
                  <span className="text-muted-foreground text-[11px]">
                    {t('published', { date: new Date(data.publishedAt).toLocaleDateString() })}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {data.checkDisabled ? (
            <p className="text-muted-foreground max-w-prose text-xs">{t('checksDisabledHint')}</p>
          ) : null}

          {!data.checkDisabled && !data.latest ? (
            <p className="text-muted-foreground max-w-prose text-xs">{t('notCheckedHint')}</p>
          ) : null}

          {data.updateAvailable ? (
            <div className="space-y-4">
              {data.notes ? (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium">{t('releaseNotes')}</h4>
                  {/* Release notes are untrusted upstream text — rendered as plain
                      text only (React-escaped), never as HTML/markdown. */}
                  <pre className="border-border bg-muted/50 text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 font-sans text-xs">
                    {data.notes}
                  </pre>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <h4 className="text-xs font-medium">{t('howToUpdate')}</h4>
                <p className="text-muted-foreground text-xs">{t('howToUpdateHint')}</p>
                <pre className="border-border bg-muted/50 rounded-md border px-3 py-2 font-mono text-xs">
                  {UPDATE_COMMANDS}
                </pre>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheckNow}
              disabled={refresh.isPending || data.checkDisabled}
              title={data.checkDisabled ? t('checksDisabledHint') : undefined}
            >
              {refresh.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {refresh.isPending ? t('checking') : t('checkNow')}
            </Button>
            {data.updateAvailable && isHttpsUrl(data.releaseUrl) ? (
              <Button size="sm" variant="outline" asChild>
                <a href={data.releaseUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t('viewRelease')}
                </a>
              </Button>
            ) : null}
            {data.checkedAt ? (
              <span className="text-muted-foreground text-[11px]">
                {t('lastChecked', { time: new Date(data.checkedAt).toLocaleString() })}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatusChip({
  info,
}: {
  info: { updateAvailable: boolean; latest: string | null; checkDisabled: boolean };
}) {
  const t = useTranslations('adminUpdates');

  if (info.checkDisabled) {
    return (
      <span className="chip text-muted-foreground text-[11px]">{t('statusChecksDisabled')}</span>
    );
  }
  if (info.updateAvailable) {
    return (
      <span className="chip-amber inline-flex items-center gap-1 text-[11px]">
        <ArrowUpCircle className="h-3 w-3" />
        {t('statusUpdateAvailable')}
      </span>
    );
  }
  if (info.latest) {
    return (
      <span className="chip-emerald inline-flex items-center gap-1 text-[11px]">
        <Check className="h-3 w-3" />
        {t('statusUpToDate')}
      </span>
    );
  }
  return <span className="chip text-muted-foreground text-[11px]">{t('statusUnknown')}</span>;
}
