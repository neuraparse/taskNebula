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

const mockUseProjectPermissions = jest.fn();
jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: () => mockUseProjectPermissions(),
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
  beforeEach(() => {
    mockUseProjectPermissions.mockReturnValue({
      permissions: {
        canBrowseProject: true,
        canAdministerProject: true,
        canManageMembers: false,
        canInviteMembers: false,
        canChangeRoles: false,
        canManageWorkflow: false,
        isSuperAdmin: false,
        isOrgOwner: false,
        isOrgAdmin: false,
      },
      isLoading: false,
    });
  });

  it('renders the general tab by default', () => {
    render(<ProjectSettingsContent projectId="proj-1" />);

    expect(screen.getByTestId('manager-general')).toHaveTextContent('general:proj-1');
    expect(screen.getByRole('tab', { name: /members & permissions/i })).toBeInTheDocument();
    expect(screen.queryByTestId('manager-workflows')).not.toBeInTheDocument();
  });

  it('renders the dialog navigation layout when embedded in the settings modal', () => {
    render(<ProjectSettingsContent projectId="proj-1" variant="dialog" />);

    expect(screen.getByRole('tablist', { name: /project settings sections/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByTestId('manager-general')).toHaveTextContent('general:proj-1');
  });

  it('switches to the workflows tab and renders the workflow editor', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();
    render(
      <ProjectSettingsContent projectId="proj-1" initialTab="general" onTabChange={onTabChange} />
    );

    const workflowsTab = screen.getByRole('tab', { name: /workflows/i });
    await user.click(workflowsTab);

    await waitFor(() => {
      expect(screen.getByTestId('manager-workflows')).toBeInTheDocument();
    });
    expect(screen.getByTestId('manager-workflows')).toHaveTextContent('workflow-editor:proj-1');
    expect(onTabChange).toHaveBeenCalledWith('workflows');
  });

  it('allows organization admins through the project settings guard', () => {
    mockUseProjectPermissions.mockReturnValue({
      permissions: {
        canBrowseProject: false,
        canAdministerProject: false,
        canManageMembers: false,
        canInviteMembers: false,
        canChangeRoles: false,
        canManageWorkflow: false,
        isSuperAdmin: false,
        isOrgOwner: false,
        isOrgAdmin: true,
      },
      isLoading: false,
    });

    render(<ProjectSettingsContent projectId="proj-1" />);

    expect(screen.getByTestId('manager-general')).toBeInTheDocument();
    expect(
      screen.queryByText("You don't have permission to access project settings.")
    ).not.toBeInTheDocument();
  });

  it('hides admin-only tabs for project member managers', async () => {
    mockUseProjectPermissions.mockReturnValue({
      permissions: {
        canBrowseProject: true,
        canAdministerProject: false,
        canManageMembers: true,
        canInviteMembers: false,
        canChangeRoles: false,
        canManageWorkflow: false,
        isSuperAdmin: false,
        isOrgOwner: false,
        isOrgAdmin: false,
      },
      isLoading: false,
    });

    render(<ProjectSettingsContent projectId="proj-1" initialTab="automation" />);

    await waitFor(() => {
      expect(screen.getByTestId('manager-permissions')).toBeInTheDocument();
    });
    expect(screen.queryByRole('tab', { name: /automation/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('manager-automation')).not.toBeInTheDocument();
  });

  it('denies settings content for browse-only project users', () => {
    mockUseProjectPermissions.mockReturnValue({
      permissions: {
        canBrowseProject: true,
        canAdministerProject: false,
        canManageMembers: false,
        canInviteMembers: false,
        canChangeRoles: false,
        canManageWorkflow: false,
        isSuperAdmin: false,
        isOrgOwner: false,
        isOrgAdmin: false,
      },
      isLoading: false,
    });

    render(<ProjectSettingsContent projectId="proj-1" />);

    expect(
      screen.getByText("You don't have permission to access project settings.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId('manager-general')).not.toBeInTheDocument();
  });
});
