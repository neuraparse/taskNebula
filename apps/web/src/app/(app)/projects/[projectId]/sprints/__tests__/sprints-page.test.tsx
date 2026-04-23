/**
 * Tests for SprintsPage — /projects/[projectId]/sprints
 *
 * Covers:
 *   - renders a list of sprints when the hook returns data
 *   - renders the empty state when there are no sprints
 *   - clicking "New Sprint" opens the CreateSprintModal which triggers the
 *     useCreateSprint mutation when submitted
 */

import { Suspense, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SprintsPage from '../page';
import { useSprints, useDeleteSprint } from '@/lib/hooks/use-sprints';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';

jest.mock('@/lib/hooks/use-sprints', () => ({
  useSprints: jest.fn(),
  useDeleteSprint: jest.fn(),
}));

jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: jest.fn(),
}));

// The create modal is tested separately; here we only verify the button
// wires up to it, so render a lightweight stand-in that exposes the
// open flag + gives us a button we can click to invoke onOpenChange.
const mockCreateModal = jest.fn();
jest.mock('@/components/sprints/create-sprint-modal', () => ({
  CreateSprintModal: (props: {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    mockCreateModal(props);
    return props.open ? <div data-testid="create-sprint-modal">modal-open</div> : null;
  },
}));

const mockUseSprints = useSprints as jest.MockedFunction<typeof useSprints>;
const mockUseDeleteSprint = useDeleteSprint as jest.MockedFunction<typeof useDeleteSprint>;
const mockUseProjectPermissions = useProjectPermissions as jest.MockedFunction<
  typeof useProjectPermissions
>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-fallback" />}>{children}</Suspense>
    </QueryClientProvider>
  );
}

// React 19's `use(promise)` suspends indefinitely on a plain Promise in
// tests unless the promise is pre-tagged as fulfilled.
function resolvedParams<T extends object>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & { status: string; value: T };
  p.status = 'fulfilled';
  p.value = value;
  return p;
}

function setPermissions(overrides: Record<string, boolean> = {}) {
  mockUseProjectPermissions.mockReturnValue({
    permissions: {
      canBrowseProject: true,
      canManageSprints: true,
      canDeleteSprint: true,
      canStartSprint: true,
      canCompleteSprint: true,
      isSuperAdmin: false,
      isOrgOwner: false,
      ...overrides,
    },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useProjectPermissions>);
}

describe('SprintsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateModal.mockReset();

    mockUseDeleteSprint.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteSprint>);

    setPermissions();
  });

  it('renders a list of sprints with names and issue counts', async () => {
    mockUseSprints.mockReturnValue({
      data: [
        {
          id: 'sprint-1',
          projectId: 'project-1',
          name: 'Sprint Alpha',
          goal: 'Ship the MVP',
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: new Date('2026-04-15T00:00:00.000Z'),
          status: 'active',
          issueCount: 7,
        },
        {
          id: 'sprint-2',
          projectId: 'project-1',
          name: 'Sprint Beta',
          goal: null,
          startDate: new Date('2026-04-16T00:00:00.000Z'),
          endDate: new Date('2026-04-30T00:00:00.000Z'),
          status: 'planned',
          issueCount: 0,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprints>);

    render(
      <Wrapper>
        <SprintsPage params={resolvedParams({ projectId: 'project-1' })} />
      </Wrapper>
    );

    expect(await screen.findByText('Sprint Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sprint Beta')).toBeInTheDocument();
    expect(screen.getByText('Ship the MVP')).toBeInTheDocument();
    expect(screen.getByText('7 issues')).toBeInTheDocument();
    expect(screen.getByText('0 issues')).toBeInTheDocument();
  });

  it('renders the empty state when there are no sprints', async () => {
    mockUseSprints.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprints>);

    render(
      <Wrapper>
        <SprintsPage params={resolvedParams({ projectId: 'project-1' })} />
      </Wrapper>
    );

    expect(
      await screen.findByText('No sprints yet. Create your first to plan iteration.')
    ).toBeInTheDocument();
  });

  it('opens the CreateSprintModal when the New Sprint button is clicked', async () => {
    const user = userEvent.setup();
    mockUseSprints.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprints>);

    render(
      <Wrapper>
        <SprintsPage params={resolvedParams({ projectId: 'project-1' })} />
      </Wrapper>
    );

    // Initially modal is rendered with open=false
    expect(mockCreateModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'project-1', open: false })
    );

    // Click the header "New Sprint" button — there are two (header + empty
    // state CTA), so grab the first.
    const buttons = screen.getAllByRole('button', { name: /New Sprint|Create Sprint/i });
    await user.click(buttons[0]!);

    // Modal should have been re-rendered with open=true
    expect(mockCreateModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ projectId: 'project-1', open: true })
    );
    expect(screen.getByTestId('create-sprint-modal')).toBeInTheDocument();
  });

  it('hides the New Sprint button when the user lacks canManageSprints', async () => {
    setPermissions({ canManageSprints: false });
    mockUseSprints.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprints>);

    render(
      <Wrapper>
        <SprintsPage params={resolvedParams({ projectId: 'project-1' })} />
      </Wrapper>
    );

    expect(screen.queryByRole('button', { name: /New Sprint/i })).not.toBeInTheDocument();
    expect(
      await screen.findByText('No sprints have been created for this project yet.')
    ).toBeInTheDocument();
  });
});
