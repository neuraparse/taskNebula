import { fireEvent, render, screen } from '@testing-library/react';
import { InboxPageClient } from '../inbox-client';
import {
  useInbox,
  useInboxMarkAllRead,
  useInboxMarkRead,
  useInboxSnooze,
} from '@/lib/hooks/use-inbox';

let searchParams = new URLSearchParams();
const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}));

jest.mock('@/lib/hooks/use-inbox', () => ({
  useInbox: jest.fn(),
  useInboxMarkAllRead: jest.fn(),
  useInboxMarkRead: jest.fn(),
  useInboxSnooze: jest.fn(),
}));

const mockUseInbox = useInbox as jest.MockedFunction<typeof useInbox>;
const mockUseInboxMarkAllRead = useInboxMarkAllRead as jest.MockedFunction<
  typeof useInboxMarkAllRead
>;
const mockUseInboxMarkRead = useInboxMarkRead as jest.MockedFunction<typeof useInboxMarkRead>;
const mockUseInboxSnooze = useInboxSnooze as jest.MockedFunction<typeof useInboxSnooze>;

function mockMutation() {
  return {
    mutate: jest.fn(),
    isPending: false,
  };
}

describe('InboxPageClient', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    replaceMock.mockReset();
    mockUseInbox.mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useInbox>);
    mockUseInboxMarkAllRead.mockReturnValue(
      mockMutation() as unknown as ReturnType<typeof useInboxMarkAllRead>
    );
    mockUseInboxMarkRead.mockReturnValue(
      mockMutation() as unknown as ReturnType<typeof useInboxMarkRead>
    );
    mockUseInboxSnooze.mockReturnValue(
      mockMutation() as unknown as ReturnType<typeof useInboxSnooze>
    );
  });

  it('turns URL query params into inbox data filters', () => {
    searchParams = new URLSearchParams('actor=agent&unread=1&type=mention');

    render(<InboxPageClient />);

    expect(mockUseInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actorType: 'agent',
        notificationType: 'mention',
        unread: true,
        snoozed: false,
      })
    );
    expect(screen.getByRole('radio', { name: /agents/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: /unread only/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('writes filter chip changes back to the URL', () => {
    render(<InboxPageClient />);

    fireEvent.click(screen.getByRole('checkbox', { name: /unread only/i }));
    expect(replaceMock).toHaveBeenCalledWith('/inbox?unread=1', { scroll: false });

    fireEvent.click(screen.getByRole('radio', { name: /agents/i }));
    expect(replaceMock).toHaveBeenLastCalledWith('/inbox?actor=agent&unread=1', {
      scroll: false,
    });
  });

  it('exposes the reaction notification type filter', () => {
    searchParams = new URLSearchParams('type=reaction');

    render(<InboxPageClient />);

    expect(mockUseInbox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        notificationType: 'reaction',
      })
    );
    expect(screen.getByRole('radio', { name: /reactions/i })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});
