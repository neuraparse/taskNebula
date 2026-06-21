'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomFieldManager } from '@/components/custom-fields/custom-field-manager';
import { PermissionManager } from '@/components/permissions/permission-manager';
import { PermissionSchemeManager } from '@/components/permissions/permission-scheme-manager';
import { IssueSecurityManager } from '@/components/security/issue-security-manager';
import { VersionsManager } from '@/components/settings/versions-manager';
import { ComponentsManager } from '@/components/settings/components-manager';
import { WorkflowEditor } from '@/components/workflows/workflow-editor';
import { AutomationManager } from '@/components/automation/automation-manager';
import { WebhooksManager } from '@/components/settings/webhooks-manager';
import { ProjectGeneralSettings } from '@/components/settings/project-general-settings';
import { ProjectAiAgents } from '@/components/settings/project-ai-agents';
import { ProjectCommunicationsSettings } from '@/components/settings/project-communications-settings';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import type { UserProjectPermissions } from '@/lib/hooks/use-project-permissions';
import {
  Shield,
  Settings,
  Workflow,
  Zap,
  FileText,
  Lock,
  Key,
  Webhook,
  Bot,
  Boxes,
  MessageSquareText,
  Rocket,
} from 'lucide-react';

const TABS = [
  { value: 'general', labelKey: 'tab_general', icon: Settings },
  { value: 'permissions', labelKey: 'tab_permissions', icon: Shield },
  { value: 'schemes', labelKey: 'tab_schemes', icon: Key },
  { value: 'security', labelKey: 'tab_security', icon: Lock },
  { value: 'custom-fields', labelKey: 'tab_custom_fields', icon: FileText },
  { value: 'versions', labelKey: 'tab_versions', icon: Rocket },
  { value: 'components', labelKey: 'tab_components', icon: Boxes },
  { value: 'workflows', labelKey: 'tab_workflows', icon: Workflow },
  { value: 'automation', labelKey: 'tab_automation', icon: Zap },
  { value: 'ai-agents', labelKey: 'tab_ai_agents', icon: Bot },
  { value: 'chat-calls', labelKey: 'tab_chat_calls', icon: MessageSquareText },
  { value: 'webhooks', labelKey: 'tab_webhooks', icon: Webhook },
] as const;

type TabValue = (typeof TABS)[number]['value'];

function hasElevatedProjectAccess(permissions: UserProjectPermissions): boolean {
  return (
    permissions.isSuperAdmin ||
    permissions.isOrgOwner ||
    permissions.isOrgAdmin ||
    permissions.canAdministerProject
  );
}

function canAccessSettingsShell(permissions: UserProjectPermissions): boolean {
  return (
    hasElevatedProjectAccess(permissions) ||
    (permissions.canBrowseProject &&
      (permissions.canManageMembers ||
        permissions.canInviteMembers ||
        permissions.canChangeRoles ||
        permissions.canManageWorkflow))
  );
}

function canAccessTab(tab: TabValue, permissions: UserProjectPermissions): boolean {
  const elevated = hasElevatedProjectAccess(permissions);

  switch (tab) {
    case 'permissions':
      return (
        elevated ||
        permissions.canManageMembers ||
        permissions.canInviteMembers ||
        permissions.canChangeRoles
      );
    case 'workflows':
      return elevated || permissions.canManageWorkflow;
    case 'general':
    case 'schemes':
    case 'security':
    case 'custom-fields':
    case 'versions':
    case 'components':
    case 'automation':
    case 'ai-agents':
    case 'chat-calls':
    case 'webhooks':
      return elevated;
  }
}

function isTabValue(value: string | null): value is TabValue {
  return Boolean(value) && TABS.some((tab) => tab.value === value);
}

export interface ProjectSettingsContentProps {
  projectId: string;
  initialTab?: TabValue;
  onTabChange?: (tab: TabValue) => void;
}

/**
 * Shared content for project settings. Rendered both in the standalone page
 * (for deep links) and inside the compact dialog triggered from the project
 * top bar. Does not render a header — the caller supplies one.
 */
export function ProjectSettingsContent({
  projectId,
  initialTab = 'general',
  onTabChange,
}: ProjectSettingsContentProps) {
  const t = useTranslations('projectsPages');
  const { currentOrganizationId } = useOrganization();
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canAccessTab(tab.value, permissions)),
    [permissions]
  );
  const validTabs = useMemo(() => visibleTabs.map((tab) => tab.value), [visibleTabs]);
  const [activeTab, setActiveTab] = useState<TabValue>(
    isTabValue(initialTab) ? initialTab : 'general'
  );
  const previousInitialTabRef = useRef(initialTab);

  useEffect(() => {
    const fallbackTab =
      isTabValue(initialTab) && validTabs.includes(initialTab)
        ? initialTab
        : (validTabs[0] ?? 'general');
    const initialTabChanged = previousInitialTabRef.current !== initialTab;
    previousInitialTabRef.current = initialTab;

    setActiveTab((current) => {
      if (initialTabChanged || !validTabs.includes(current)) {
        return fallbackTab;
      }

      return current;
    });
  }, [initialTab, validTabs]);

  function handleTabChange(next: string) {
    if (!validTabs.includes(next as TabValue)) return;
    setActiveTab(next as TabValue);
    onTabChange?.(next as TabValue);
  }

  if (!currentOrganizationId || permissionsLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (!canAccessSettingsShell(permissions) || visibleTabs.length === 0) {
    return (
      <div className="p-6">
        <div className="panel-danger rounded-lg p-6 text-center">
          <p className="text-destructive text-sm">{t('no_settings_permission')}</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="border-border bg-background border-b">
        <TabsList
          aria-label={t('settings_sections_aria')}
          className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:bg-transparent"
              >
                <Icon className="h-4 w-4" />
                <span>{t(tab.labelKey)}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <TabsContent value="permissions" className="focus-visible:outline-none">
          {activeTab === 'permissions' && canAccessTab('permissions', permissions) ? (
            <PermissionManager projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="schemes" className="focus-visible:outline-none">
          {activeTab === 'schemes' && canAccessTab('schemes', permissions) ? (
            <PermissionSchemeManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="security" className="focus-visible:outline-none">
          {activeTab === 'security' && canAccessTab('security', permissions) ? (
            <IssueSecurityManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="custom-fields" className="focus-visible:outline-none">
          {activeTab === 'custom-fields' && canAccessTab('custom-fields', permissions) ? (
            <CustomFieldManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="versions" className="focus-visible:outline-none">
          {activeTab === 'versions' && canAccessTab('versions', permissions) ? (
            <VersionsManager projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="components" className="focus-visible:outline-none">
          {activeTab === 'components' && canAccessTab('components', permissions) ? (
            <ComponentsManager projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="workflows" className="focus-visible:outline-none">
          {activeTab === 'workflows' && canAccessTab('workflows', permissions) ? (
            <WorkflowEditor organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="automation" className="focus-visible:outline-none">
          {activeTab === 'automation' && canAccessTab('automation', permissions) ? (
            <AutomationManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="ai-agents" className="focus-visible:outline-none">
          {activeTab === 'ai-agents' && canAccessTab('ai-agents', permissions) ? (
            <ProjectAiAgents projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="chat-calls" className="focus-visible:outline-none">
          {activeTab === 'chat-calls' && canAccessTab('chat-calls', permissions) ? (
            <ProjectCommunicationsSettings projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="webhooks" className="focus-visible:outline-none">
          {activeTab === 'webhooks' && canAccessTab('webhooks', permissions) ? (
            <WebhooksManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="general" className="focus-visible:outline-none">
          {activeTab === 'general' && canAccessTab('general', permissions) ? (
            <ProjectGeneralSettings projectId={projectId} />
          ) : null}
        </TabsContent>
      </div>
    </Tabs>
  );
}
