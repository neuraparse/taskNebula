'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const validTabs = useMemo(() => TABS.map((tab) => tab.value), []);
  const [activeTab, setActiveTab] = useState<TabValue>(
    isTabValue(initialTab) ? initialTab : 'general'
  );

  useEffect(() => {
    if (isTabValue(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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

  if (!permissions.canBrowseProject && !permissions.isSuperAdmin && !permissions.isOrgOwner) {
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
          {TABS.map((tab) => {
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
          {activeTab === 'permissions' ? <PermissionManager projectId={projectId} /> : null}
        </TabsContent>
        <TabsContent value="schemes" className="focus-visible:outline-none">
          {activeTab === 'schemes' ? (
            <PermissionSchemeManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="security" className="focus-visible:outline-none">
          {activeTab === 'security' ? (
            <IssueSecurityManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="custom-fields" className="focus-visible:outline-none">
          {activeTab === 'custom-fields' ? (
            <CustomFieldManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="versions" className="focus-visible:outline-none">
          {activeTab === 'versions' ? <VersionsManager projectId={projectId} /> : null}
        </TabsContent>
        <TabsContent value="components" className="focus-visible:outline-none">
          {activeTab === 'components' ? <ComponentsManager projectId={projectId} /> : null}
        </TabsContent>
        <TabsContent value="workflows" className="focus-visible:outline-none">
          {activeTab === 'workflows' ? (
            <WorkflowEditor organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="automation" className="focus-visible:outline-none">
          {activeTab === 'automation' ? (
            <AutomationManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="ai-agents" className="focus-visible:outline-none">
          {activeTab === 'ai-agents' ? <ProjectAiAgents projectId={projectId} /> : null}
        </TabsContent>
        <TabsContent value="chat-calls" className="focus-visible:outline-none">
          {activeTab === 'chat-calls' ? (
            <ProjectCommunicationsSettings projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="webhooks" className="focus-visible:outline-none">
          {activeTab === 'webhooks' ? (
            <WebhooksManager organizationId={currentOrganizationId} projectId={projectId} />
          ) : null}
        </TabsContent>
        <TabsContent value="general" className="focus-visible:outline-none">
          {activeTab === 'general' ? <ProjectGeneralSettings projectId={projectId} /> : null}
        </TabsContent>
      </div>
    </Tabs>
  );
}
