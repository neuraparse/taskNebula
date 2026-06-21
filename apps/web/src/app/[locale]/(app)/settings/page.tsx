'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { AuditLogViewer } from '@/components/audit/audit-log-viewer';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { OrganizationAiAgentsSettings } from '@/components/settings/organization-ai-agents';
import { OrganizationCommunicationsSettings } from '@/components/settings/organization-communications-settings';
import { LabelsManager } from '@/components/settings/labels-manager';
import { MembersPageClient } from './members/members-page-client';
import { OrganizationSettingsClient } from './organization/organization-settings-client';
import { AiTransparencyClient } from './ai-transparency/ai-transparency-client';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useAiFeature } from '@/lib/hooks/use-ai-feature';
import { useOrganizationPermissions } from '@/lib/hooks/use-permissions';
import type { Permission } from '@tasknebula/db';
import {
  Palette,
  Building2,
  Users,
  Bell,
  Key,
  Webhook,
  ScrollText,
  Bot,
  MessageSquareText,
  Sparkles,
  Tags,
} from 'lucide-react';

type NavItem = {
  value:
    | 'organization'
    | 'members'
    | 'api-keys'
    | 'webhooks'
    | 'labels'
    | 'notifications'
    | 'appearance'
    | 'ai-agents'
    | 'ai-transparency'
    | 'communications'
    | 'audit-log';
  labelKey: string;
  icon: typeof Building2;
  // Permission required to see this tab. `undefined` means every member sees it.
  requiredPermissions?: Permission;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    value: 'organization',
    labelKey: 'nav.organization',
    icon: Building2,
    requiredPermissions: 'org:settings',
  },
  {
    // Every member can view members; `member:invite` is enforced inside the manager.
    value: 'members',
    labelKey: 'nav.members',
    icon: Users,
    requiredPermissions: 'member:view',
  },
  {
    value: 'api-keys',
    labelKey: 'nav.apiKeys',
    icon: Key,
    requiredPermissions: 'api_key:view',
  },
  {
    value: 'webhooks',
    labelKey: 'nav.webhooks',
    icon: Webhook,
    requiredPermissions: 'webhook:view',
  },
  { value: 'labels', labelKey: 'nav.labels', icon: Tags },
  { value: 'notifications', labelKey: 'nav.notifications', icon: Bell },
  { value: 'appearance', labelKey: 'nav.appearance', icon: Palette },
  {
    value: 'ai-agents',
    labelKey: 'nav.aiAgents',
    icon: Bot,
    requiredPermissions: 'org:settings',
  },
  {
    value: 'ai-transparency',
    labelKey: 'aiTransparency.title',
    icon: Sparkles,
    requiredPermissions: 'org:settings',
  },
  {
    value: 'communications',
    labelKey: 'nav.communications',
    icon: MessageSquareText,
    requiredPermissions: 'org:settings',
  },
  {
    value: 'audit-log',
    labelKey: 'nav.activity',
    icon: ScrollText,
    requiredPermissions: 'org:manage',
  },
] as const;

type TabValue = NavItem['value'];

const PERSONAL_TABS = new Set<TabValue>(['appearance']);
const UNGATED_TABS = new Set<TabValue>(['labels', 'notifications', 'appearance']);

export default function SettingsPage() {
  const t = useTranslations('pagesSettings');
  const { currentOrganizationId } = useOrganization();
  const { aiEnabled } = useAiFeature();
  const perms = useOrganizationPermissions(currentOrganizationId ?? undefined);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const visibleNavItems = useMemo<readonly NavItem[]>(() => {
    if (!currentOrganizationId) {
      return NAV_ITEMS.filter((item) => PERSONAL_TABS.has(item.value));
    }
    if (perms.isLoading) {
      return NAV_ITEMS.filter((item) => UNGATED_TABS.has(item.value));
    }
    return NAV_ITEMS.filter((item) => {
      if (!item.requiredPermissions) return true;
      return perms.has(item.requiredPermissions);
    });
  }, [currentOrganizationId, perms]);

  const validTabs = useMemo(() => visibleNavItems.map((item) => item.value), [visibleNavItems]);

  const requestedTab = searchParams.get('tab') as TabValue | null;
  const initialTab: TabValue = useMemo(() => {
    if (requestedTab && (validTabs as readonly string[]).includes(requestedTab)) {
      return requestedTab;
    }
    // Fallback: prefer 'organization' when visible, otherwise the first tab.
    if ((validTabs as readonly string[]).includes('organization')) {
      return 'organization';
    }
    return (validTabs[0] ?? 'appearance') as TabValue;
  }, [requestedTab, validTabs]);

  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function handleTabChange(nextTab: TabValue) {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Permission-aware content: a direct navigation to a gated tab that the user
  // is not authorised for shows a friendly notice instead of the manager.
  const activeNavItem = NAV_ITEMS.find((item) => item.value === activeTab);
  const activeTabRequires = activeNavItem?.requiredPermissions;
  const activeTabDenied =
    !perms.isLoading && activeTabRequires !== undefined && !perms.has(activeTabRequires);

  return (
    <div className="animate-fade-in flex min-h-0 flex-1 flex-col">
      {/* Mobile tab bar — main sidebar already hosts the nav on desktop.
          Horizontally scrollable so every tab is reachable on narrow screens;
          scrollbar hidden, with trailing padding so the last tab clears the edge. */}
      <div className="scrollbar-none border-border flex flex-nowrap gap-1 overflow-x-auto whitespace-nowrap border-b py-2 pl-4 lg:hidden">
        {visibleNavItems.map(({ value, labelKey, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleTabChange(value)}
            data-active={activeTab === value ? 'true' : undefined}
            className="row-interactive shrink-0 gap-1.5 px-3 py-1.5 text-sm"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(labelKey)}</span>
          </button>
        ))}
        {/* Trailing spacer: guarantees the last tab clears the right edge even
            though flex overflow containers can collapse trailing padding. */}
        <span aria-hidden className="w-4 shrink-0" />
      </div>

      <div className="animate-fade-up flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto w-full max-w-5xl">
          {activeTabDenied ? (
            <NoAccessNotice />
          ) : (
            renderContent(activeTab, currentOrganizationId, aiEnabled)
          )}
        </div>
      </div>
    </div>
  );
}

function renderContent(tab: TabValue, organizationId: string | null, aiEnabled: boolean) {
  switch (tab) {
    case 'appearance':
      return <AppearanceSettings />;
    case 'organization':
      if (!organizationId) return <NoAccessNotice />;
      return <OrganizationSettingsClient />;
    case 'members':
      if (!organizationId) return <NoAccessNotice />;
      return <MembersPageClient />;
    case 'ai-agents':
      if (!organizationId) return <NoAccessNotice />;
      if (!aiEnabled) return <AiDisabledNotice />;
      return <OrganizationAiAgentsSettings organizationId={organizationId} />;
    case 'ai-transparency':
      if (!organizationId) return <NoAccessNotice />;
      return <AiTransparencyClient organizationId={organizationId} />;
    case 'communications':
      if (!organizationId) return <NoAccessNotice />;
      return <OrganizationCommunicationsSettings organizationId={organizationId} />;
    case 'labels':
      if (!organizationId) return <NoAccessNotice />;
      return <LabelsManager organizationId={organizationId} />;
    case 'notifications':
      if (!organizationId) return <NoAccessNotice />;
      return <NotificationPreferences />;
    case 'api-keys':
      if (!organizationId) return <NoAccessNotice />;
      return <ApiKeysManager organizationId={organizationId} />;
    case 'webhooks':
      if (!organizationId) return <NoAccessNotice />;
      return <WebhooksManager organizationId={organizationId} />;
    case 'audit-log':
      if (!organizationId) return <NoAccessNotice />;
      return <AuditLogViewer organizationId={organizationId} />;
    default:
      return null;
  }
}

function AiDisabledNotice() {
  const t = useTranslations('pagesSettings');
  return (
    <div className="surface-card space-y-2 p-8 text-center">
      <p className="text-foreground text-sm font-medium">{t('aiDisabled.title')}</p>
      <p className="text-muted-foreground text-sm">
        {t.rich('aiDisabled.body', {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
    </div>
  );
}

function NoAccessNotice() {
  const t = useTranslations('pagesSettings');
  return (
    <div className="surface-card space-y-2 p-8 text-center">
      <p className="text-foreground text-sm font-medium">{t('noAccess.title')}</p>
      <p className="text-muted-foreground text-sm">{t('noAccess.body')}</p>
    </div>
  );
}
