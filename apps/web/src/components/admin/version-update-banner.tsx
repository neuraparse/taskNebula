'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useVersionPoll } from '@/lib/hooks/use-version-poll';
import { cn } from '@/lib/utils';
import { ArrowUpCircle, X } from 'lucide-react';

// Keyed by the dismissed update version so the banner reappears for the next one.
const DISMISS_STORAGE_KEY = 'tasknebula-update-banner-dismissed';

function formatVersion(version: string) {
  return `v${version.replace(/^v/, '')}`;
}

type VersionUpdateBannerProps = {
  onView?: () => void;
  viewHref?: string | null;
  className?: string;
};

export function VersionUpdateBanner({
  onView,
  viewHref = '/admin?tab=updates',
  className,
}: VersionUpdateBannerProps) {
  const t = useTranslations('adminUpdates');
  // Polls the version endpoint on mount and on a gentle 6h interval (matching
  // the server cache) so a freshly-pulled image surfaces the banner without a
  // manual "Check now" click. Shares the cache with the version panel.
  const { data } = useVersionPoll();
  const [hydrated, setHydrated] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissedVersion(window.localStorage.getItem(DISMISS_STORAGE_KEY));
    } catch {
      // localStorage unavailable (private mode) — banner just stays dismissible per session.
    }
    setHydrated(true);
  }, []);

  if (
    !hydrated ||
    data?.updatePreferences?.bannerEnabled === false ||
    !data?.updateAvailable ||
    !data.latest ||
    dismissedVersion === data.latest
  ) {
    return null;
  }

  const latest: string = data.latest;
  const dockerOnlyUpdate =
    data.image.updateAvailable && !data.releaseUpdateAvailable && data.image.latestTag
      ? {
          tag: data.image.latestTag,
          repository: data.image.repository,
        }
      : null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, latest);
    } catch {
      // Ignore storage failures; state below still hides it for this session.
    }
    setDismissedVersion(latest);
  };

  return (
    <div
      className={cn(
        'panel-warn animate-fade-up flex flex-wrap items-center gap-3 px-4 py-3',
        className
      )}
    >
      <ArrowUpCircle className="text-accent-amber h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {dockerOnlyUpdate
            ? t('banner.dockerTitle', { tag: formatVersion(dockerOnlyUpdate.tag) })
            : t('banner.title', { version: formatVersion(latest) })}
        </p>
        <p className="text-muted-foreground text-xs">
          {dockerOnlyUpdate
            ? t('banner.dockerBody', {
                current: formatVersion(data.current),
                repository: dockerOnlyUpdate.repository,
                tag: formatVersion(dockerOnlyUpdate.tag),
              })
            : t('banner.body', { current: formatVersion(data.current) })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onView ? (
          <Button size="sm" variant="outline" onClick={onView}>
            {t('banner.view')}
          </Button>
        ) : viewHref ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={viewHref}>{t('banner.view')}</Link>
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleDismiss}
          aria-label={t('banner.dismiss')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
