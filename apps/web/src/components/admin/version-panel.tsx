'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  useRefreshVersionInfo,
  useStartSelfUpdate,
  useVersionInfo,
  type SelfUpdateStatus,
  type VersionInfo,
} from '@/lib/hooks/use-version-info';
import {
  AlertTriangle,
  ArrowUpCircle,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

function formatVersion(version: string) {
  return `v${version.replace(/^v/, '')}`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDigest(digest: string) {
  return digest.length > 24 ? `${digest.slice(0, 24)}...` : digest;
}

// Release URLs come from the GitHub API via our backend; render only https links.
function isHttpsUrl(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

export function VersionPanel() {
  const t = useTranslations('adminUpdates');
  const formatter = useFormatter();
  const { toast } = useToast();
  const { data, isLoading, error } = useVersionInfo();
  const refresh = useRefreshVersionInfo();
  const startUpdate = useStartSelfUpdate();
  const [acknowledged, setAcknowledged] = useState(false);

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

  function handleStartSelfUpdate(targetVersion: string) {
    startUpdate.mutate(targetVersion, {
      onSuccess: () => {
        setAcknowledged(false);
        toast({
          title: t('selfUpdate.startedTitle'),
          description: t('selfUpdate.startedDescription'),
        });
      },
      onError: (err: Error) => {
        toast({
          title: t('selfUpdate.failedTitle'),
          description: err.message,
          variant: 'destructive',
        });
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
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
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
                    {t('published', {
                      date: formatter.dateTime(new Date(data.publishedAt), {
                        dateStyle: 'medium',
                      }),
                    })}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t('latestDockerImage')}</dt>
              <dd className="flex items-center gap-2">
                {data.image.latestTag ? (
                  <span className="chip font-mono text-[11px]">
                    {formatVersion(data.image.latestTag)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
                {data.image.latestPushedAt ? (
                  <span className="text-muted-foreground text-[11px]">
                    {t('imagePushed', {
                      date: formatter.dateTime(new Date(data.image.latestPushedAt), {
                        dateStyle: 'medium',
                      }),
                    })}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {data.image.latestTag ? (
            <div className="border-border bg-muted/30 space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <h4 className="text-xs font-medium">{t('dockerImage')}</h4>
                  <p className="text-muted-foreground text-xs">
                    {t('dockerImageDescription', { repository: data.image.repository })}
                  </p>
                </div>
                {data.image.updateAvailable ? (
                  <span className="chip-amber text-[11px]">{t('imageUpdateAvailable')}</span>
                ) : null}
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{t('repository')}</dt>
                  <dd className="truncate font-mono">{data.image.repository}</dd>
                </div>
                {data.image.latestDigest ? (
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">{t('imageDigest')}</dt>
                    <dd className="truncate font-mono" title={data.image.latestDigest}>
                      {formatDigest(data.image.latestDigest)}
                    </dd>
                  </div>
                ) : null}
                {data.image.latestSizeBytes ? (
                  <div>
                    <dt className="text-muted-foreground">{t('imageSize')}</dt>
                    <dd>{formatBytes(data.image.latestSizeBytes) ?? '—'}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

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
                  {data.selfUpdate?.manualCommands ?? manualUpdateCommands(data)}
                </pre>
              </div>

              <SelfUpdateCard
                info={data}
                selfUpdate={data.selfUpdate}
                acknowledged={acknowledged}
                pending={startUpdate.isPending}
                onAcknowledgeChange={setAcknowledged}
                onStart={handleStartSelfUpdate}
              />
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
            {isHttpsUrl(data.image.latestTagUrl) ? (
              <Button size="sm" variant="outline" asChild>
                <a href={data.image.latestTagUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {t('viewDockerTag')}
                </a>
              </Button>
            ) : null}
            {data.checkedAt ? (
              <span className="text-muted-foreground text-[11px]">
                {t('lastChecked', {
                  time: formatter.dateTime(new Date(data.checkedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function manualUpdateCommands(info: VersionInfo) {
  const repository = info.image.repository;
  const tag = info.image.latestTag ?? info.latest ?? '<version>';
  return [
    `# Set TASKNEBULA_IMAGE=${repository}:${tag} in .env for pinned installs.`,
    `TASKNEBULA_IMAGE=${repository}:${tag} docker compose pull web`,
    `TASKNEBULA_IMAGE=${repository}:${tag} docker compose up -d web`,
    'docker compose ps web',
  ].join('\n');
}

function SelfUpdateCard({
  info,
  selfUpdate,
  acknowledged,
  pending,
  onAcknowledgeChange,
  onStart,
}: {
  info: VersionInfo;
  selfUpdate: SelfUpdateStatus | undefined;
  acknowledged: boolean;
  pending: boolean;
  onAcknowledgeChange: (checked: boolean) => void;
  onStart: (targetVersion: string) => void;
}) {
  const t = useTranslations('adminUpdates');
  const formatter = useFormatter();
  const targetVersion = selfUpdate?.targetVersion ?? info.image.latestTag ?? info.latest;
  const canStart = Boolean(selfUpdate?.available && targetVersion && acknowledged && !pending);
  const blockedReason = selfUpdate?.blockedReason;
  const job = selfUpdate?.job ?? null;

  return (
    <div className="border-border bg-muted/30 space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {selfUpdate?.available ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="text-muted-foreground h-4 w-4" />
            )}
            <h4 className="text-xs font-medium">{t('selfUpdate.title')}</h4>
          </div>
          <p className="text-muted-foreground max-w-prose text-xs">
            {selfUpdate?.available
              ? t('selfUpdate.readyDescription')
              : t('selfUpdate.manualFallbackDescription')}
          </p>
        </div>
        <span className={selfUpdate?.available ? 'chip-emerald text-[11px]' : 'chip text-[11px]'}>
          {selfUpdate?.available ? t('selfUpdate.available') : t('selfUpdate.manualOnly')}
        </span>
      </div>

      {blockedReason ? (
        <p className="text-muted-foreground text-xs">{t(`selfUpdate.blocked.${blockedReason}`)}</p>
      ) : null}

      {job ? (
        <div className="border-border bg-background/50 space-y-1 rounded-md border p-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {t('selfUpdate.jobTitle', { version: formatVersion(job.targetVersion) })}
            </span>
            <span className="chip text-[11px]">{t(`selfUpdate.jobStatus.${job.status}`)}</span>
          </div>
          {job.failureReason ? (
            <p className="text-destructive whitespace-pre-wrap">{job.failureReason}</p>
          ) : (
            <p className="text-muted-foreground">
              {t('selfUpdate.jobUpdated', {
                time: formatter.dateTime(new Date(job.updatedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </p>
          )}
        </div>
      ) : null}

      {selfUpdate?.available && targetVersion ? (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => onAcknowledgeChange(checked === true)}
              aria-label={t('selfUpdate.acknowledge')}
            />
            <span className="text-muted-foreground">{t('selfUpdate.acknowledge')}</span>
          </label>
          <Button size="sm" onClick={() => onStart(targetVersion)} disabled={!canStart}>
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="mr-1.5 h-3.5 w-3.5" />
            )}
            {pending
              ? t('selfUpdate.starting')
              : t('selfUpdate.start', { version: formatVersion(targetVersion) })}
          </Button>
        </div>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Terminal className="h-3.5 w-3.5" />
          {t('selfUpdate.manualOption')}
        </div>
      )}
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
