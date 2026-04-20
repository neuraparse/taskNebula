import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBell } from '../notification-bell';
import {
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
  useUnreadNotificationsCount,
} from '@/lib/hooks/use-notifications';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-notifications', () => ({
  useNotifications: jest.fn(),
  useMarkNotificationAsRead: jest.fn(),
  useMarkAllNotificationsAsRead: jest.fn(),
  useDeleteNotification: jest.fn(),
  useUnreadNotificationsCount: jest.fn(),
}));

jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
  MockLink.displayName = 'MockLink';
  return { __esModule: true, default: MockLink };
});

const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;
const mockUseMarkAsRead = useMarkNotificationAsRead as jest.MockedFunction<
  typeof useMarkNotificationAsRead
>;
const mockUseMarkAllAsRead = useMarkAllNotificationsAsRead as jest.MockedFunction<
  typeof useMarkAllNotificationsAsRead
>;
const mockUseDelete = useDeleteNotification as jest.MockedFunction<typeof useDeleteNotification>;
const mockUseUnreadCount = useUnreadNotificationsCount as jest.MockedFunction<
  typeof useUnreadNotificationsCount
>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('NotificationBell', () => {
  const markAsReadMutate = jest.fn();
  const markAllAsReadMutate = jest.fn();
  const deleteMutate = jest.fn();

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

    mockUseMarkAsRead.mockReturnValue({
      mutate: markAsReadMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useMarkNotificationAsRead>);

    mockUseMarkAllAsRead.mockReturnValue({
      mutate: markAllAsReadMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useMarkAllNotificationsAsRead>);

    mockUseDelete.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteNotification>);

    mockUseUnreadCount.mockReturnValue(0);

    mockUseNotifications.mockReturnValue({
      data: { notifications: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useNotifications>);
  });

  it('renders the bell trigger button', () => {
    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows the unread count badge when there are unread notifications', () => {
    mockUseUnreadCount.mockReturnValue(3);

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps the badge display at "9+" when unread count exceeds 9', () => {
    mockUseUnreadCount.mockReturnValue(42);

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('shows the empty state when there are no notifications', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    await user.click(screen.getByRole('button'));

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('calls the mark-as-read mutation when clicking the "Mark read" action', async () => {
    const user = userEvent.setup();

    mockUseUnreadCount.mockReturnValue(1);
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            id: 'notif-1',
            type: 'mention',
            title: 'You were mentioned',
            message: 'Bayram mentioned you in an issue',
            isRead: false,
            createdAt: new Date().toISOString(),
            actor: { id: 'u1', name: 'Bayram' },
            issueId: 'issue-1',
          },
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useNotifications>);

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    await user.click(screen.getByRole('button'));

    const markReadButton = await screen.findByRole('button', { name: /Mark read/i });
    await user.click(markReadButton);

    expect(markAsReadMutate).toHaveBeenCalledWith('notif-1');
  });

  it('calls mark-all-as-read when clicking the header action', async () => {
    const user = userEvent.setup();

    mockUseUnreadCount.mockReturnValue(2);
    mockUseNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            id: 'notif-1',
            type: 'comment',
            title: 'New comment',
            message: 'A teammate commented',
            isRead: false,
            createdAt: new Date().toISOString(),
            actor: { id: 'u1', name: 'Alice' },
          },
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useNotifications>);

    render(
      <Wrapper>
        <NotificationBell />
      </Wrapper>
    );

    await user.click(screen.getByRole('button'));
    const markAll = await screen.findByRole('button', { name: /Mark all as read/i });
    await user.click(markAll);

    expect(markAllAsReadMutate).toHaveBeenCalled();
  });
});
