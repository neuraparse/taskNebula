import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PermissionManager } from '../permission-manager';

const refetchMock = jest.fn();
const toastMock = jest.fn();

let membersMock: Array<{
  id: string;
  userId: string;
  projectId: string;
  role: string;
  permissions: Record<string, boolean>;
  user: { id: string; name: string; email: string; image: string | null };
}> = [];

let permissionsMock: Record<string, unknown> = {};

jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectMembers: () => ({
    members: membersMock,
    isLoading: false,
    refetch: refetchMock,
  }),
  useProjectPermissions: () => ({
    permissions: permissionsMock,
    isLoading: false,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

jest.mock('../add-project-member-dialog', () => ({
  AddProjectMemberDialog: ({
    open,
    onAdded,
  }: {
    open: boolean;
    onAdded?: () => void | Promise<void>;
  }) =>
    open ? (
      <div role="dialog" aria-label="Add project member">
        <button type="button" onClick={() => void onAdded?.()}>
          Complete add
        </button>
      </div>
    ) : null,
}));

function renderPermissionManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PermissionManager projectId="proj-1" />
    </QueryClientProvider>
  );
}

describe('PermissionManager', () => {
  beforeAll(() => {
    class TestResizeObserver {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    }

    Object.defineProperty(global, 'ResizeObserver', {
      writable: true,
      value: TestResizeObserver,
    });
  });

  beforeEach(() => {
    refetchMock.mockResolvedValue(undefined);
    toastMock.mockReset();
    membersMock = [
      {
        id: 'member-1',
        userId: 'user-1',
        projectId: 'proj-1',
        role: 'developer',
        permissions: {},
        user: {
          id: 'user-1',
          name: 'Alice Admin',
          email: 'alice@example.com',
          image: null,
        },
      },
    ];
    permissionsMock = {
      canChangeRoles: false,
      canInviteMembers: false,
      canManageMembers: true,
      canRemoveMembers: false,
      isSuperAdmin: false,
      isOrgAdmin: false,
      isOrgOwner: false,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows add and remove controls for project member managers', async () => {
    const user = userEvent.setup();
    renderPermissionManager();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('dialog', { name: 'Add project member' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Alice Admin from project' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/projects/proj-1/members/member-1', {
        method: 'DELETE',
      });
    });
    expect(refetchMock).toHaveBeenCalled();
  });
});
