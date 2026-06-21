import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectLayoutClient } from '../project-layout-client';
import {
  useProjectPermissions,
  type UserProjectPermissions,
} from '@/lib/hooks/use-project-permissions';
import { usePathname, useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: jest.fn(),
}));

jest.mock('@/components/projects/project-settings-dialog', () => ({
  ProjectSettingsDialog: () => null,
}));

const mockUseProjectPermissions = useProjectPermissions as jest.MockedFunction<
  typeof useProjectPermissions
>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

const initialProject = {
  id: 'project-1',
  key: 'PRJ',
  name: 'Project One',
  organizationId: 'org-1',
};

function projectPermissions(
  overrides: Partial<UserProjectPermissions> = {}
): UserProjectPermissions {
  return {
    isMember: true,
    role: 'viewer',
    isSuperAdmin: false,
    isOrgOwner: false,
    isOrgAdmin: false,
    canBrowseProject: false,
    canAdministerProject: false,
    canBrowseDocs: false,
    canCreateDocs: false,
    canEditDocs: false,
    canDeleteDocs: false,
    canBrowseChat: false,
    canCreateChannels: false,
    canPostMessages: false,
    canModerateMessages: false,
    canStartCalls: false,
    canManageCalls: false,
    canManageSprints: false,
    canStartSprint: false,
    canCompleteSprint: false,
    canDeleteSprint: false,
    canCreateIssues: false,
    canEditIssues: false,
    canEditOwnIssues: false,
    canDeleteIssues: false,
    canDeleteOwnIssues: false,
    canAssignIssues: false,
    canAssigneeIssues: false,
    canTransitionIssues: false,
    canScheduleIssues: false,
    canMoveIssues: false,
    canLinkIssues: false,
    canCloseIssues: false,
    canReopenIssues: false,
    canAddComments: false,
    canEditOwnComments: false,
    canEditAllComments: false,
    canDeleteOwnComments: false,
    canDeleteAllComments: false,
    canCreateAttachments: false,
    canDeleteOwnAttachments: false,
    canDeleteAllAttachments: false,
    canManageWatchers: false,
    canViewWatchers: false,
    canManageMembers: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canManageWorkflow: false,
    canLogWork: false,
    canEditOwnWorklogs: false,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: false,
    canDeleteAllWorklogs: false,
    ...overrides,
  };
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePathname.mockReturnValue('/projects/prj/views');
  mockUseRouter.mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

it('hides docs and chat tabs while project permissions are loading', () => {
  mockUseProjectPermissions.mockReturnValue({
    permissions: projectPermissions(),
    isLoading: true,
    error: null,
  } as unknown as ReturnType<typeof useProjectPermissions>);

  render(
    <Wrapper>
      <ProjectLayoutClient projectId="prj" initialProject={initialProject}>
        <div />
      </ProjectLayoutClient>
    </Wrapper>
  );

  expect(screen.getByRole('tab', { name: /views/i })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /docs/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /chat/i })).not.toBeInTheDocument();
});

it('hides docs, chat, and settings actions from read-only project viewers without those capabilities', () => {
  mockUseProjectPermissions.mockReturnValue({
    permissions: projectPermissions({ canBrowseProject: true }),
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectPermissions>);

  render(
    <Wrapper>
      <ProjectLayoutClient projectId="prj" initialProject={initialProject}>
        <div />
      </ProjectLayoutClient>
    </Wrapper>
  );

  expect(screen.getByRole('tab', { name: /views/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /sprints/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /modules/i })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /docs/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: /chat/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /project settings/i })).not.toBeInTheDocument();
});

it('shows docs and chat tabs only when their project permissions are present', () => {
  mockUseProjectPermissions.mockReturnValue({
    permissions: projectPermissions({
      canBrowseProject: true,
      canBrowseDocs: true,
      canBrowseChat: true,
    }),
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectPermissions>);

  render(
    <Wrapper>
      <ProjectLayoutClient projectId="prj" initialProject={initialProject}>
        <div />
      </ProjectLayoutClient>
    </Wrapper>
  );

  expect(screen.getByRole('tab', { name: /docs/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /chat/i })).toBeInTheDocument();
});
