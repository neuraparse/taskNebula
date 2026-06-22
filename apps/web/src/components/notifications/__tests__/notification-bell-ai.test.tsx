import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from '../notification-bell';

jest.mock('@/lib/hooks/use-notifications', () => {
  const actual = jest.requireActual('@/lib/hooks/use-notifications');
  return {
    ...actual,
    useNotifications: jest.fn(),
    useUnreadNotificationsCount: jest.fn().mockReturnValue({ data: { count: 2 } }),
    useMarkNotificationAsRead: jest.fn().mockReturnValue({ mutateAsync: jest.fn() }),
    useMarkAllNotificationsAsRead: jest
      .fn()
      .mockReturnValue({ mutateAsync: jest.fn(), isPending: false }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { useNotifications } = require('@/lib/hooks/use-notifications');

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = 'QC';
  return Wrapper;
}

describe('NotificationBell — AI/agent notification rendering', () => {
  beforeEach(() => {
    (useNotifications as jest.Mock).mockReturnValue({
      data: {
        notifications: [
          {
            id: 'n1',
            type: 'ai_draft_failed',
            title: 'AI draft failed',
            message: 'openai · Rate limit exceeded. Open Settings → AI & Agents to add a key.',
            issueId: null,
            projectId: 'proj-1',
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
            actor: null,
          },
          {
            id: 'n2',
            type: 'agent_run_failed',
            title: 'Agent run failed · backlog_triage',
            message: 'Provider not configured. Check Settings → AI & Agents for details.',
            issueId: null,
            projectId: 'proj-1',
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
            actor: null,
          },
        ],
      },
      isLoading: false,
    });
  });

  it('renders ai_draft_failed with "AI draft" label and action text in body', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />, { wrapper: makeWrapper() });
    const trigger = screen.getByRole('button', { name: /notifications/i });
    await user.click(trigger);

    const label = await screen.findByText('AI draft');
    expect(label).toBeInTheDocument();
    expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument();
  });

  it('renders agent_run_failed with "Agent run" label', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />, { wrapper: makeWrapper() });
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByText('Agent run')).toBeInTheDocument();
  });

  it('deep-links AI failure rows to project AI settings', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />, { wrapper: makeWrapper() });
    await user.click(screen.getByRole('button', { name: /notifications/i }));

    await screen.findByText('AI draft');
    const links = document.querySelectorAll('a[href*="/projects/proj-1/settings?tab=ai-agents"]');
    expect(links.length).toBeGreaterThanOrEqual(2);
  });
});
