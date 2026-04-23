import { Suspense } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import RoadmapPage from '../page';

async function renderPage(projectId: string) {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>fallback</div>}>
        <RoadmapPage params={Promise.resolve({ projectId })} />
      </Suspense>,
    );
  });
  return result!;
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const fetchMock = jest.fn();

describe('RoadmapPage (smoke)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('renders empty state when the API returns no epics', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ issues: [] }),
    });

    await renderPage('p1');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /initiatives/i })).toBeInTheDocument();
    });
    expect(await screen.findByText(/no initiatives yet/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/issues?projectId=p1&type=epic'),
    );
  });

  it('renders epic titles when the API returns data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        issues: [
          {
            id: 'epic-1',
            title: 'Launch v1.0',
            description: null,
            status: 'in_progress',
            priority: 'high',
            startDate: '2026-04-01',
            targetDate: '2026-04-30',
          },
        ],
      }),
    });

    await renderPage('p1');

    // There are two renderings (left pane + Gantt bar) — use getAllByText.
    const matches = await screen.findAllByText('Launch v1.0');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
