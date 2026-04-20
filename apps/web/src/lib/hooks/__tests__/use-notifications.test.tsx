import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
} from '../use-notifications';

const fetchMock = jest.fn();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('use-notifications hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('useNotifications', () => {
    it('fetches all notifications when unreadOnly is false', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          notifications: [
            { id: 'notif-1', type: 'mention', title: 'You were mentioned', isRead: false },
          ],
        }),
      });

      const { result } = renderHook(() => useNotifications(false), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.data?.notifications).toHaveLength(1);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications?');
    });

    it('appends unreadOnly=true when filtering unread notifications', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [] }),
      });

      const { result } = renderHook(() => useNotifications(true), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications?unreadOnly=true');
    });

    it('surfaces an error when the notifications request fails', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to fetch notifications');
    });
  });

  describe('useMarkNotificationAsRead', () => {
    it('PATCHes the notification endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useMarkNotificationAsRead(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync('notif-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications/notif-1', {
        method: 'PATCH',
      });
    });
  });

  describe('useMarkAllNotificationsAsRead', () => {
    it('PATCHes the notifications collection endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useMarkAllNotificationsAsRead(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications', {
        method: 'PATCH',
      });
    });
  });

  describe('useDeleteNotification', () => {
    it('DELETEs the notification endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useDeleteNotification(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync('notif-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications/notif-1', {
        method: 'DELETE',
      });
    });

    it('throws when the delete response is not ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useDeleteNotification(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('notif-1');
        })
      ).rejects.toThrow('Failed to delete notification');
    });
  });
});
