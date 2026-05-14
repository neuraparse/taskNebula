import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import ProjectAnalyticsPage from '../page';
import { useProjectHealth, useVelocity } from '@/lib/hooks/use-analytics';

async function renderPage(projectId: string) {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>fallback</div>}>
        <ProjectAnalyticsPage params={Promise.resolve({ projectId })} />
      </Suspense>,
    );
  });
  return result!;
}

jest.mock('@/lib/hooks/use-analytics', () => ({
  useProjectHealth: jest.fn(),
  useVelocity: jest.fn(),
  exportIssues: jest.fn(),
}));

jest.mock('@/components/analytics/velocity-chart', () => ({
  VelocityChart: () => <div data-testid="velocity-chart" />,
}));

jest.mock('@/components/analytics/issue-distribution-charts', () => ({
  IssueDistributionCharts: () => <div data-testid="distribution-charts" />,
}));

const mockUseProjectHealth = useProjectHealth as jest.MockedFunction<
  typeof useProjectHealth
>;
const mockUseVelocity = useVelocity as jest.MockedFunction<typeof useVelocity>;

describe('ProjectAnalyticsPage (smoke)', () => {
  beforeEach(() => {
    mockUseProjectHealth.mockReset();
    mockUseVelocity.mockReset();
  });

  it('shows the loading state while analytics queries are pending', async () => {
    mockUseProjectHealth.mockReturnValue({ data: undefined, isLoading: true } as any);
    mockUseVelocity.mockReturnValue({ data: undefined, isLoading: false } as any);

    await renderPage('p1');

    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
  });

  it('renders stat cards with values from project health data', async () => {
    mockUseProjectHealth.mockReturnValue({
      data: {
        overview: {
          totalIssues: 42,
          overdueIssues: 3,
          unassignedIssues: 7,
        },
        sprints: { total: 4, active: 1, completed: 3 },
        issuesByStatus: [],
        issuesByPriority: [],
        issuesByType: [],
      },
      isLoading: false,
    } as any);
    mockUseVelocity.mockReturnValue({
      data: { sprints: [], averageVelocity: { issues: 0, points: 0 } },
      isLoading: false,
    } as any);

    await renderPage('p1');

    expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument(); // total issues
    expect(screen.getByText('3')).toBeInTheDocument(); // overdue
    expect(screen.getByText('7')).toBeInTheDocument(); // unassigned
    expect(screen.getByTestId('distribution-charts')).toBeInTheDocument();
  });
});
