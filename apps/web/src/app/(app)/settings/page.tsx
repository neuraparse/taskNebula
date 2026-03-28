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
    <div className="space-y-6 p-6 bg-gradient-mesh min-h-full">
      <div className="animate-in fade-in slide-in-from-top-4">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization and preferences
        </p>
      </div>

      <Tabs defaultValue="appearance" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 animate-delay-100">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="audit-log" className="gap-2">
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
