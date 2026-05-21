import { render, screen } from '@testing-library/react';

import { DraftsList } from '../drafts-list';
import { useDrafts, type Draft } from '@/lib/drafts/use-drafts';

// The page wraps DraftsList which delegates everything to `useDrafts`.
// Mock the hook so we can drive the render paths without touching the
// network / react-query runtime. `next/navigation` is only touched via
// the promote flow, so we stub a router for completeness.
jest.mock('@/lib/drafts/use-drafts', () => ({
  useDrafts: jest.fn(),
}));

jest.mock('@/lib/hooks/use-projects', () => ({
  useProjects: () => ({ data: [{ id: 'project-1', name: 'Demo', key: 'DEM' }] }),
}));

jest.mock('@/components/issues/create-issue-modal', () => ({
  CreateIssueModal: () => null,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const mockUseDrafts = useDrafts as jest.MockedFunction<typeof useDrafts>;

function baseHookReturn(drafts: Draft[]): ReturnType<typeof useDrafts> {
  return {
    drafts,
    isLoading: false,
    isError: false,
    error: null,
    addDraft: jest.fn(),
    updateDraft: jest.fn(),
    removeDraft: jest.fn(),
    promoteDraft: jest.fn(),
  };
}

describe('DraftsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders drafts returned by the hook', () => {
    const now = Date.now();
    const drafts: Draft[] = [
      {
        id: 'd1',
        type: 'work_item',
        title: 'Investigate flaky CI job',
        body: 'Recent failures on the e2e runner need a triage pass.',
        createdAt: now - 60_000,
        updatedAt: now - 30_000,
      },
    ];
    mockUseDrafts.mockReturnValue(baseHookReturn(drafts));

    render(<DraftsList />);

    expect(screen.getByText('Investigate flaky CI job')).toBeInTheDocument();
    // Filter tabs should show the live count (all=1, work_item=1)
    expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument();
  });

  it('shows the empty state when there are no drafts', () => {
    mockUseDrafts.mockReturnValue(baseHookReturn([]));

    render(<DraftsList />);

    expect(screen.getByText('No drafts yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create work item/i })).toBeInTheDocument();
  });
});
