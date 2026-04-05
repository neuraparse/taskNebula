'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomFieldManager } from '@/components/custom-fields/custom-field-manager';
import { PermissionManager } from '@/components/permissions/permission-manager';
import { PermissionSchemeManager } from '@/components/permissions/permission-scheme-manager';
import { IssueSecurityManager } from '@/components/security/issue-security-manager';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';
import { AutomationManager } from '@/components/automation/automation-manager';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { ProjectGeneralSettings } from '@/components/settings/project-general-settings';
import { ProjectAiAgents } from '@/components/settings/project-ai-agents';
import { ProjectCommunicationsSettings } from '@/components/settings/project-communications-settings';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { Shield, Settings, Workflow, Zap, FileText, Lock, Key, Webhook, Bot, MessageSquareText } from 'lucide-react';

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganizationId } = useOrganization();
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);
  const validTabs = useMemo(
    () => ['permissions', 'schemes', 'security', 'custom-fields', 'workflows', 'automation', 'ai-agents', 'chat-calls', 'webhooks', 'general'],
    []
  );
  const requestedTab = searchParams.get('tab');
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'general';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  function handleTabChange(nextTab: string) {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
                <TabsTrigger value="ai-agents" className="flex items-center gap-2 px-4 py-2">
                  <Bot className="h-4 w-4" />
                  <span>AI Agents</span>
                </TabsTrigger>
                <TabsTrigger value="chat-calls" className="flex items-center gap-2 px-4 py-2">
                  <MessageSquareText className="h-4 w-4" />
                  <span>Chat & Calls</span>
                </TabsTrigger>
                <TabsTrigger value="webhooks" className="flex items-center gap-2 px-4 py-2">
                  <Webhook className="h-4 w-4" />
                  <span>Webhooks</span>
                </TabsTrigger>
                <TabsTrigger value="general" className="flex items-center gap-2 px-4 py-2">
                  <Settings className="h-4 w-4" />
                  <span>General</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="permissions" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'permissions' ? <PermissionManager projectId={projectId} /> : null}
            </TabsContent>

            <TabsContent value="schemes" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'schemes' ? (
                <PermissionSchemeManager organizationId={currentOrganizationId} projectId={projectId} />
              ) : null}
            </TabsContent>

            <TabsContent value="security" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'security' ? (
                <IssueSecurityManager organizationId={currentOrganizationId} projectId={projectId} />
              ) : null}
            </TabsContent>

            <TabsContent value="custom-fields" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'custom-fields' ? (
                <CustomFieldManager organizationId={currentOrganizationId} projectId={projectId} />
              ) : null}
            </TabsContent>

            <TabsContent value="workflows" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'workflows' ? (
                <WorkflowEditor organizationId={currentOrganizationId} projectId={projectId} />
              ) : null}
            </TabsContent>

            <TabsContent value="automation" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'automation' ? (
                <AutomationManager organizationId={currentOrganizationId} projectId={projectId} />
              ) : null}
            </TabsContent>

            <TabsContent value="ai-agents" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'ai-agents' ? <ProjectAiAgents projectId={projectId} /> : null}
            </TabsContent>

            <TabsContent value="chat-calls" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'chat-calls' ? <ProjectCommunicationsSettings projectId={projectId} /> : null}
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'webhooks' ? (
                <WebhooksManager organizationId={currentOrganizationId} projectId={projectId} />
              ) : null}
            </TabsContent>

            <TabsContent value="general" className="space-y-4 focus-visible:outline-none">
              {activeTab === 'general' ? <ProjectGeneralSettings projectId={projectId} /> : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
