'use client';

import { use } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomFieldManager } from '@/components/custom-fields/custom-field-manager';
import { PermissionManager } from '@/components/permissions/permission-manager';
import { PermissionSchemeManager } from '@/components/permissions/permission-scheme-manager';
import { IssueSecurityManager } from '@/components/security/issue-security-manager';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';
import { AutomationManager } from '@/components/automation/automation-manager';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { Shield, Settings, Workflow, Zap, FileText, Lock, Key } from 'lucide-react';

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { currentOrganizationId } = useOrganization();
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);

  if (!currentOrganizationId || permissionsLoading) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    );
  }

  // Check if user can access settings
  if (!permissions.canBrowseProject && !permissions.isSuperAdmin && !permissions.isOrgOwner) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-800">You don't have permission to access project settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
          <p className="text-muted-foreground">Manage your project configuration, permissions, and custom fields.</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Tabs defaultValue="permissions" className="space-y-6">
            <div className="sticky top-0 z-10 bg-background pb-4">
              <TabsList className="inline-flex h-auto w-auto rounded-lg bg-muted p-1">
                <TabsTrigger value="permissions" className="flex items-center gap-2 px-4 py-2">
                  <Shield className="h-4 w-4" />
                  <span>Permissions</span>
                </TabsTrigger>
                <TabsTrigger value="schemes" className="flex items-center gap-2 px-4 py-2">
                  <Key className="h-4 w-4" />
                  <span>Schemes</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2 px-4 py-2">
                  <Lock className="h-4 w-4" />
                  <span>Security</span>
                </TabsTrigger>
                <TabsTrigger value="custom-fields" className="flex items-center gap-2 px-4 py-2">
                  <FileText className="h-4 w-4" />
                  <span>Custom Fields</span>
                </TabsTrigger>
                <TabsTrigger value="workflows" className="flex items-center gap-2 px-4 py-2">
                  <Workflow className="h-4 w-4" />
                  <span>Workflows</span>
                </TabsTrigger>
                <TabsTrigger value="automation" className="flex items-center gap-2 px-4 py-2">
                  <Zap className="h-4 w-4" />
                  <span>Automation</span>
                </TabsTrigger>
                <TabsTrigger value="general" className="flex items-center gap-2 px-4 py-2">
                  <Settings className="h-4 w-4" />
                  <span>General</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="permissions" className="space-y-4 focus-visible:outline-none">
              <PermissionManager projectId={projectId} />
            </TabsContent>

            <TabsContent value="schemes" className="space-y-4 focus-visible:outline-none">
              <PermissionSchemeManager organizationId={currentOrganizationId} />
            </TabsContent>

            <TabsContent value="security" className="space-y-4 focus-visible:outline-none">
              <IssueSecurityManager organizationId={currentOrganizationId} />
            </TabsContent>

            <TabsContent value="custom-fields" className="space-y-4 focus-visible:outline-none">
              <CustomFieldManager organizationId={currentOrganizationId} projectId={projectId} />
            </TabsContent>

            <TabsContent value="workflows" className="space-y-4 focus-visible:outline-none">
              <WorkflowEditor organizationId={currentOrganizationId} />
            </TabsContent>

            <TabsContent value="automation" className="space-y-4 focus-visible:outline-none">
              <AutomationManager organizationId={currentOrganizationId} projectId={projectId} />
            </TabsContent>

            <TabsContent value="general" className="space-y-4 focus-visible:outline-none">
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>General settings coming soon...</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

