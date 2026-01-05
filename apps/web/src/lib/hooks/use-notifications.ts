import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'assigned'
  | 'status_changed'
  | 'issue_created'
  | 'issue_updated'
  | 'issue_linked'
  | 'sprint_started'
  | 'sprint_completed';

export interface NotificationActor {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  issueId: string | null;
  projectId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  actor: NotificationActor | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

// Fetch notifications
export function useNotifications(unreadOnly: boolean = false) {
  return useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unreadOnly) params.append('unreadOnly', 'true');

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<NotificationsResponse>;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// Mark single notification as read
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Mark all notifications as read
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Delete notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Get unread count
export function useUnreadNotificationsCount() {
  const { data } = useNotifications(true);
  return data?.notifications?.length || 0;
}

