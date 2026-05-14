/**
 * Tests for BacklogPage — /projects/[projectId]/backlog
 *
 * Covers:
 *   - issues list renders when API returns backlog issues (no sprintId)
 *   - empty state renders when there are no backlog issues
 */

import { Suspense, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BacklogPage from '../page';
import { useIssues } from '@/lib/hooks/use-issues';
import { useSprints, useAssignIssueToSprint } from '@/lib/hooks/use-sprints';
import { useAiCapability } from '@/lib/hooks/use-ai-capability';

jest.mock('@/lib/hooks/use-issues', () => ({
  useIssues: jest.fn(),
  useUpdateIssue: jest.fn(() => ({ mutate: jest.fn(), mutateAsync: jest.fn() })),
}));

jest.mock('@/lib/hooks/use-sprints', () => ({
  useSprints: jest.fn(),
  useAssignIssueToSprint: jest.fn(),
}));

jest.mock('@/lib/hooks/use-ai-capability', () => ({
  useAiCapability: jest.fn(),
}));

// Child modal components are not under test
jest.mock('@/components/issues/create-issue-modal', () => ({
  CreateIssueModal: () => null,
}));
jest.mock('@/components/issues/issue-detail-modal', () => ({
  IssueDetailModal: () => null,
}));
jest.mock('@/components/ai/ai-draft-issue-dialog', () => ({
  AiDraftIssueDialog: () => null,
}));

const mockUseIssues = useIssues as jest.MockedFunction<typeof useIssues>;
const mockUseSprints = useSprints as jest.MockedFunction<typeof useSprints>;
const mockUseAssignIssueToSprint = useAssignIssueToSprint as jest.MockedFunction<typeof useAssignIssueToSprint>;
const mockUseAiCapability = useAiCapability as jest.MockedFunction<typeof useAiCapability>;

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

// React 19's `use(promise)` checks for a `status` tag and will suspend
// indefinitely on a plain Promise in tests. Pre-resolve + tag so `use()`
// unwraps synchronously on the first render.
function resolvedParams<T extends object>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & { status: string; value: T };
  p.status = 'fulfilled';
  p.value = value;
  return p;
}

describe('BacklogPage', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAssignIssueToSprint.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAssignIssueToSprint>);
    mockUseAiCapability.mockReturnValue({ canDraft: false } as ReturnType<typeof useAiCapability>);
    mockUseSprints.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprints>);
  });

  it('renders the list of backlog issues (issues without sprintId)', async () => {
    mockUseIssues.mockReturnValue({
      data: [
        {
          id: 'i-1',
          key: 'PRJ-1',
          title: 'Set up project skeleton',
          type: 'task',
          priority: 'high',
          sprintId: null,
          estimate: 3,
        },
        {
          id: 'i-2',
          key: 'PRJ-2',
          title: 'Write README',
          type: 'story',
          priority: 'medium',
          sprintId: null,
          estimate: null,
        },
        // This issue is assigned to a sprint — must be filtered out
        {
          id: 'i-3',
          key: 'PRJ-3',
          title: 'Already in sprint',
          type: 'bug',
          priority: 'low',
          sprintId: 'sprint-1',
          estimate: 2,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useIssues>);

    render(
      <Wrapper>
        <BacklogPage params={resolvedParams({ projectId: 'project-1' })} />
      </Wrapper>
    );

    expect(await screen.findByText('Set up project skeleton')).toBeInTheDocument();
    expect(screen.getByText('Write README')).toBeInTheDocument();
    // The sprint-assigned issue should not appear in the backlog list
    expect(screen.queryByText('Already in sprint')).not.toBeInTheDocument();
    // Header count should be "2 issues"
    expect(screen.getByText('2 issues')).toBeInTheDocument();
  });

  it('renders the empty state when the backlog is empty', async () => {
    mockUseIssues.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useIssues>);

    render(
      <Wrapper>
        <BacklogPage params={resolvedParams({ projectId: 'project-1' })} />
      </Wrapper>
    );

    expect(
      await screen.findByText('Backlog is empty. All issues are assigned to sprints.')
    ).toBeInTheDocument();
    // There should be a "Create Issue" CTA inside the empty state
    expect(screen.getByRole('button', { name: /Create Issue/i })).toBeInTheDocument();
  });
});
