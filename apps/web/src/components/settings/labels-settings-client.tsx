'use client';

import { useTranslations } from 'next-intl';
import { useOrganization } from '@/lib/hooks/use-organization';
import { LabelsManager } from './labels-manager';

/**
 * Client shell for the standalone /settings/labels page. Resolves the active
 * organization from the workspace switcher store (same source as the tabbed
 * org settings page) and renders the header + manager.
 */
export function LabelsSettingsClient() {
  const t = useTranslations('settings.labels');
  const tCommon = useTranslations('common');
  const { currentOrganizationId } = useOrganization();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t('subtitle')}</p>
      </header>
      {currentOrganizationId ? (
        <LabelsManager organizationId={currentOrganizationId} />
      ) : (
        <p className="text-muted-foreground text-sm">{tCommon('loading')}</p>
      )}
    </div>
  );
}
