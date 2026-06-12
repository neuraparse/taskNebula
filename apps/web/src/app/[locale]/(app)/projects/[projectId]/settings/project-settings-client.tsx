'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ProjectSettingsContent } from '@/components/projects/project-settings-content';

const VALID_TABS = [
  'general',
  'permissions',
  'schemes',
  'security',
  'custom-fields',
  'versions',
  'components',
  'workflows',
  'automation',
  'ai-agents',
  'chat-calls',
  'webhooks',
] as const;

type TabValue = (typeof VALID_TABS)[number];

function isTabValue(value: string | null): value is TabValue {
  return Boolean(value) && (VALID_TABS as readonly string[]).includes(value ?? '');
}

export function ProjectSettingsClient({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const initialTab: TabValue = isTabValue(requestedTab) ? requestedTab : 'general';

  const handleTabChange = useCallback(
    (next: TabValue) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="animate-fade-in flex h-full min-h-0 flex-col overflow-hidden">
      <ProjectSettingsContent
        projectId={projectId}
        initialTab={initialTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}
