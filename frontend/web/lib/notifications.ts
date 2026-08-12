import { apiRequest } from './api';

export type NotificationTaskSummary = {
  id: string;
  title: string;
  project_id: string | null;
  project_name: string | null;
  priority: string;
  status: string;
};

export type NotificationResponse = {
  id: string;
  task_id: string | null;
  type: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  scheduled_for: string | null;
  dedupe_key: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  task: NotificationTaskSummary | null;
};

export type NotificationListResponse = {
  items: NotificationResponse[];
  unread_count: number;
};

type RequestOptions = {
  signal?: AbortSignal;
};

export function listNotifications(limit = 5, options: RequestOptions = {}) {
  const query = new URLSearchParams({
    limit: String(limit),
  });

  return apiRequest<NotificationListResponse>(`/notifications?${query.toString()}`, {
    signal: options.signal,
  });
}

export function markNotificationsRead(notificationIds: string[], options: RequestOptions = {}) {
  return apiRequest<NotificationListResponse>('/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify(notificationIds),
    signal: options.signal,
  });
}

export function markAllNotificationsRead(options: RequestOptions = {}) {
  return apiRequest<NotificationListResponse>('/notifications/mark-all-read', {
    method: 'POST',
    signal: options.signal,
  });
}
