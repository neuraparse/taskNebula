import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AgentActivityPanel } from '../agent-activity-panel';

const mutateAsyncMock = jest.fn();

jest.mock('@/lib/hooks/use-agents', () => ({
  useIssueAgentSessions: () => ({
    data: {
      sessions: [
        {
          id: 'session-1',
          issueId: 'issue-1',
          provider: 'codex',
          externalId: null,
          state: 'active',
          payload: { localRun: { command: 'codex', status: 'running' } },
          startedAt: '2026-06-23T10:00:00Z',
          updatedAt: '2026-06-23T10:01:00Z',
          finishedAt: null,
        },
      ],
    },
    isFetching: false,
  }),
  useDispatchIssueAgent: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe('AgentActivityPanel', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ sessionId: 'session-2', provider: 'codex' });
  });

  it('renders local session history and dispatches with the selected provider', async () => {
    render(<AgentActivityPanel issueId="issue-1" agentProvider={null} />);

    expect(screen.getByText('Agent activity')).toBeInTheDocument();
    expect(screen.getByText('Issue fields')).toBeInTheDocument();
    expect(screen.getByText('Run status')).toBeInTheDocument();
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(0);
    expect(screen.getByText('Local CLI: codex')).toBeInTheDocument();
    expect(screen.getAllByText('running').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('Optional instructions for this run...'), {
      target: { value: 'keep the patch small' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dispatch' }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        provider: 'codex',
        promptOverride: 'keep the patch small',
      });
    });
  });
});
