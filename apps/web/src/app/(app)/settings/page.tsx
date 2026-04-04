'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { AuditLogViewer } from '@/components/audit/audit-log-viewer';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { MembersPageClient } from './members/members-page-client';
import { OrganizationSettingsClient } from './organization/organization-settings-client';
import { useOrganization } from '@/lib/hooks/use-organization';
import { Palette, Building2, Users, Bell, Key, Webhook, ScrollText } from 'lucide-react';

const settingsTabsListClassName =
  'h-auto w-full flex-wrap justify-start gap-2 rounded-xl border border-border/70 bg-card/40 p-1';

const settingsTabTriggerClassName =
  'gap-2 rounded-lg border border-transparent px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm';

export default function SettingsPage() {
  const { currentOrganizationId } = useOrganization();

  if (!currentOrganizationId) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Organization controls, personal preferences, and shared integrations.
        </p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className={settingsTabsListClassName}>
          <TabsTrigger value="appearance" className={settingsTabTriggerClassName}>
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="organization" className={settingsTabTriggerClassName}>
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="members" className={settingsTabTriggerClassName}>
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="notifications" className={settingsTabTriggerClassName}>
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api-keys" className={settingsTabTriggerClassName}>
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className={settingsTabTriggerClassName}>
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="audit-log" className={settingsTabTriggerClassName}>
            <ScrollText className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-4 animate-in fade-in">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="organization" className="space-y-4 animate-in fade-in">
          <OrganizationSettingsClient />
        </TabsContent>

        <TabsContent value="members" className="space-y-4 animate-in fade-in">
          <MembersPageClient />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 animate-in fade-in">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4 animate-in fade-in">
          <ApiKeysManager organizationId={currentOrganizationId} />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4 animate-in fade-in">
          <WebhooksManager organizationId={currentOrganizationId} />
        </TabsContent>

        <TabsContent value="audit-log" className="space-y-4 animate-in fade-in">
          <AuditLogViewer organizationId={currentOrganizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
