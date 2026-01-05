'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { AuditLogViewer } from '@/components/audit/audit-log-viewer';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
import { MembersPageClient } from './members/members-page-client';
import { OrganizationSettingsClient } from './organization/organization-settings-client';
import { BillingSettings } from '@/components/billing/billing-settings';
import { useOrganization } from '@/lib/hooks/use-organization';

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
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization&apos;s API keys, webhooks, and activity log.
        </p>
      </div>

      <Tabs defaultValue="organization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing & Plan</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="audit-log">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-4">
          <OrganizationSettingsClient />
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <MembersPageClient />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <ApiKeysManager organizationId={currentOrganizationId} />
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <WebhooksManager organizationId={currentOrganizationId} />
        </TabsContent>

        <TabsContent value="audit-log" className="space-y-4">
          <AuditLogViewer organizationId={currentOrganizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

