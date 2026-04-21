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
import { cn } from '@/lib/utils';
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const validTabs = useMemo(() => NAV_ITEMS.map((item) => item.value), []);
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
    <div className="animate-fade-in flex min-h-0 flex-1 gap-0">
      {/* Left nav */}
      <nav className="hidden w-52 shrink-0 border-r border-border py-6 lg:flex lg:flex-col">
        <div className="px-4 pb-4">
          <span className="kicker">Settings</span>
        </div>
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => handleTabChange(value)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                  activeTab === value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile tab bar */}
      <div className="flex w-full flex-col lg:hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
          {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabChange(value)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150',
                activeTab === value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 animate-fade-up">{renderContent(activeTab, currentOrganizationId)}</div>
      </div>

      {/* Right content */}
      <div className="hidden flex-1 overflow-y-auto p-8 lg:block">
        <div className="mx-auto max-w-3xl animate-fade-up">
          {renderContent(activeTab, currentOrganizationId)}
        </div>
      </div>
    </div>
  );
}

function renderContent(tab: TabValue, organizationId: string) {
  switch (tab) {
    case 'appearance':
      return <AppearanceSettings />;
    case 'organization':
      return <OrganizationSettingsClient />;
    case 'members':
      return <MembersPageClient />;
    case 'ai-agents':
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
