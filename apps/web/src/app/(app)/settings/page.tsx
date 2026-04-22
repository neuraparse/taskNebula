'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { AuditLogViewer } from '@/components/audit/audit-log-viewer';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { OrganizationAiAgentsSettings } from '@/components/settings/organization-ai-agents';
import { OrganizationCommunicationsSettings } from '@/components/settings/organization-communications-settings';
import { MembersPageClient } from './members/members-page-client';
import { OrganizationSettingsClient } from './organization/organization-settings-client';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useAiFeature } from '@/lib/hooks/use-ai-feature';
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
} from 'lucide-react';

const NAV_ITEMS = [
  { value: 'organization', label: 'Organization', icon: Building2 },
  { value: 'members', label: 'Members', icon: Users },
  { value: 'api-keys', label: 'API Keys', icon: Key },
  { value: 'webhooks', label: 'Webhooks', icon: Webhook },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'ai-agents', label: 'AI & Agents', icon: Bot },
  { value: 'communications', label: 'Communications', icon: MessageSquareText },
  { value: 'audit-log', label: 'Activity', icon: ScrollText },
] as const;

type TabValue = (typeof NAV_ITEMS)[number]['value'];

export default function SettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const { aiEnabled } = useAiFeature();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // AI & Agents tab is always visible so org admins can see + configure it.
  // The tab body shows an informational notice when the platform has AI off.
  const visibleNavItems = NAV_ITEMS;
  const validTabs = useMemo(() => visibleNavItems.map((item) => item.value), [visibleNavItems]);
  const requestedTab = searchParams.get('tab') as TabValue | null;
  const initialTab: TabValue =
    requestedTab && (validTabs as readonly string[]).includes(requestedTab)
      ? requestedTab
      : 'organization';
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

  if (!currentOrganizationId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex min-h-0 flex-1 flex-col">
      {/* Mobile tab bar — main sidebar already hosts the nav on desktop */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 lg:hidden">
        {visibleNavItems.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleTabChange(value)}
            data-active={activeTab === value ? 'true' : undefined}
            className="row-interactive shrink-0 gap-1.5 px-3 py-1.5 text-sm"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 animate-fade-up lg:p-8">
        <div className="mx-auto w-full max-w-5xl">
          {renderContent(activeTab, currentOrganizationId, aiEnabled)}
        </div>
      </div>
    </div>
  );
}

function renderContent(tab: TabValue, organizationId: string, aiEnabled: boolean) {
  switch (tab) {
    case 'appearance':
      return <AppearanceSettings />;
    case 'organization':
      return <OrganizationSettingsClient />;
    case 'members':
      return <MembersPageClient />;
    case 'ai-agents':
      if (!aiEnabled) return <AiDisabledNotice />;
      return <OrganizationAiAgentsSettings organizationId={organizationId} />;
    case 'communications':
      return <OrganizationCommunicationsSettings organizationId={organizationId} />;
    case 'notifications':
      return <NotificationPreferences />;
    case 'api-keys':
      return <ApiKeysManager organizationId={organizationId} />;
    case 'webhooks':
      return <WebhooksManager organizationId={organizationId} />;
    case 'audit-log':
      return <AuditLogViewer organizationId={organizationId} />;
    default:
      return null;
  }
}

function AiDisabledNotice() {
  return (
    <div className="surface-card p-8 text-center space-y-2">
      <p className="text-sm font-medium text-foreground">AI features are paused platform-wide</p>
      <p className="text-sm text-muted-foreground">
        A super-admin has to flip the master toggle in{' '}
        <strong>Admin → Agent control → Global enablement</strong> to expose the agent runtime,
        model registry, and AI-assisted task drafting to this workspace.
      </p>
    </div>
  );
}
