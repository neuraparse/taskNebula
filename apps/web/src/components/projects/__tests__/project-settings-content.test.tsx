import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectSettingsContent } from '../project-settings-content';

// The settings surface composes ~10 manager children. Each one fetches data
// on mount via hooks that would otherwise hit the network, so we shallow-mock
// them. We want to verify that the parent routes props correctly and swaps
// the rendered manager when a tab is selected — not re-test each manager.

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: 'org-1' }),
}));

jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: () => ({
    permissions: {
      canBrowseProject: true,
      canAdministerProject: true,
      isSuperAdmin: false,
      isOrgOwner: false,
    },
    isLoading: false,
  }),
}));

jest.mock('@/components/settings/project-general-settings', () => ({
  ProjectGeneralSettings: ({ projectId }: { projectId: string }) => (
    <div data-testid="manager-general">general:{projectId}</div>
  ),
}));
jest.mock('@/components/permissions/permission-manager', () => ({
  PermissionManager: () => <div data-testid="manager-permissions" />,
}));
jest.mock('@/components/permissions/permission-scheme-manager', () => ({
  PermissionSchemeManager: () => <div data-testid="manager-schemes" />,
}));
jest.mock('@/components/security/issue-security-manager', () => ({
  IssueSecurityManager: () => <div data-testid="manager-security" />,
}));
jest.mock('@/components/custom-fields/custom-field-manager', () => ({
  CustomFieldManager: () => <div data-testid="manager-custom-fields" />,
}));
jest.mock('@/components/workflows/workflow-editor', () => ({
  WorkflowEditor: ({ projectId }: { projectId?: string }) => (
    <div data-testid="manager-workflows">workflow-editor:{projectId}</div>
  ),
}));
jest.mock('@/components/automation/automation-manager', () => ({
  AutomationManager: () => <div data-testid="manager-automation" />,
}));
jest.mock('@/components/settings/webhooks-manager', () => ({
  WebhooksManager: () => <div data-testid="manager-webhooks" />,
}));
jest.mock('@/components/settings/project-ai-agents', () => ({
  ProjectAiAgents: () => <div data-testid="manager-ai-agents" />,
}));
jest.mock('@/components/settings/project-communications-settings', () => ({
  ProjectCommunicationsSettings: () => <div data-testid="manager-chat-calls" />,
}));

describe('ProjectSettingsContent', () => {
  it('renders the general tab by default', () => {
    render(<ProjectSettingsContent projectId="proj-1" />);

    expect(screen.getByTestId('manager-general')).toHaveTextContent('general:proj-1');
    expect(screen.queryByTestId('manager-workflows')).not.toBeInTheDocument();
  });

  it('switches to the workflows tab and renders the workflow editor', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();
    render(
      <ProjectSettingsContent
        projectId="proj-1"
        initialTab="general"
        onTabChange={onTabChange}
      />
    );

    const workflowsTab = screen.getByRole('tab', { name: /workflows/i });
    await user.click(workflowsTab);

    await waitFor(() => {
      expect(screen.getByTestId('manager-workflows')).toBeInTheDocument();
    });
    expect(screen.getByTestId('manager-workflows')).toHaveTextContent('workflow-editor:proj-1');
    expect(onTabChange).toHaveBeenCalledWith('workflows');
  });
});
