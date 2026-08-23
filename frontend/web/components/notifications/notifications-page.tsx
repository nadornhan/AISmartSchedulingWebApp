'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type SVGProps } from 'react';

import {
  listNotifications,
  markNotificationsRead,
  type NotificationResponse,
} from '../../lib/notifications';
import {
  CalendarIcon,
  FocusIcon,
  InsightsIcon,
} from '../layout/icons';

type NotificationIconProps = SVGProps<SVGSVGElement>;

function WarningIcon(props: NotificationIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M10.3 4.3 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function MoreHorizontalIcon(props: NotificationIconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function formatRelativeTime(value: string) {
  const createdAt = new Date(value);
  const elapsed = Date.now() - createdAt.getTime();

  if (Number.isNaN(createdAt.getTime()) || elapsed < 0) return '';

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(createdAt);
}

function notificationPresentation(notification: NotificationResponse) {
  if (notification.type === 'overdue_alert') {
    return {
      Icon: WarningIcon,
      iconClasses: 'bg-[var(--red-soft)] text-[var(--red-light)]',
    };
  }

  if (notification.type.includes('focus') || notification.type === 'productivity_reminder') {
    return {
      Icon: FocusIcon,
      iconClasses: 'bg-dashboard-accent-soft text-dashboard-accent',
    };
  }

  if (notification.type === 'task_rescheduled') {
    return {
      Icon: InsightsIcon,
      iconClasses: 'bg-dashboard-accent-soft text-dashboard-accent',
    };
  }

  return {
    Icon: CalendarIcon,
    iconClasses: 'bg-dashboard-accent-soft text-dashboard-accent',
  };
}

function notificationCopy(notification: NotificationResponse) {
  if (notification.task) {
    return {
      title: notification.message ?? notification.title,
      description: [notification.task.project_name, notification.task.status]
        .filter(Boolean)
        .join(' · '),
    };
  }

  return {
    title: notification.title,
    description: notification.message ?? '',
  };
}

export function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    setError(null);

    try {
      const response = await listNotifications(20, { signal });
      setError(null);
      setNotifications(response.items);
    } catch (requestError) {
      if (signal?.aborted || (requestError instanceof Error && requestError.name === 'AbortError')) {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load notifications.',
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotifications(controller.signal);
    return () => controller.abort();
  }, [loadNotifications]);

  async function openNotification(notification: NotificationResponse) {
    if (!notification.is_read) {
      try {
        await markNotificationsRead([notification.id]);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, is_read: true, read_at: new Date().toISOString() }
              : item,
          ),
        );
        window.dispatchEvent(new Event('notifications-updated'));
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to update the notification.',
        );
        return;
      }
    }

    if (notification.task) {
      const projectId = notification.task.project_id;
      router.push(projectId ? `/tasks?project_id=${encodeURIComponent(projectId)}` : '/tasks');
      return;
    }

    router.push(notification.type.includes('focus') ? '/focus' : '/');
  }

  return (
    <section className="-mx-6 lg:mx-auto lg:max-w-3xl lg:overflow-hidden lg:rounded-[var(--radius-lg)] lg:border lg:border-dashboard-border lg:bg-dashboard-surface/45 lg:shadow-panel">
      <div className="px-6 pb-3 lg:px-7 lg:pt-6">
        <h2 className="font-poppins text-base font-semibold text-dashboard-text">Recent</h2>
      </div>

      {error ? (
        <div className="mx-6 mb-4 rounded-[var(--radius-md)] border border-dashboard-danger/30 bg-dashboard-danger/10 p-4 text-sm text-dashboard-danger" role="alert">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading notifications" className="divide-y divide-dashboard-border/70">
          {[0, 1, 2, 3].map((item) => (
            <div className="flex min-h-28 animate-pulse items-center gap-3 px-6" key={item}>
              <span className="h-11 w-11 rounded-full bg-dashboard-surface" />
              <span className="grid flex-1 gap-2">
                <span className="h-3 w-3/5 rounded bg-dashboard-surface" />
                <span className="h-3 w-4/5 rounded bg-dashboard-surface" />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && notifications.length === 0 ? (
        <div className="grid min-h-64 place-items-center px-8 text-center">
          <div>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-dashboard-accent-soft text-dashboard-accent">
              <CalendarIcon className="h-7 w-7" />
            </span>
            <p className="mt-4 font-semibold text-dashboard-text">You’re all caught up</p>
            <p className="mt-1 text-sm text-dashboard-muted">
              Task reminders and schedule updates will appear here.
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && notifications.length > 0 ? (
        <div className="divide-y divide-dashboard-border/70 border-y border-dashboard-border/70 lg:border-b-0">
          {notifications.map((notification) => {
            const { Icon, iconClasses } = notificationPresentation(notification);
            const copy = notificationCopy(notification);

            return (
              <button
                className={`grid min-h-[106px] w-full grid-cols-[8px_44px_minmax(0,1fr)_32px] items-start gap-3 px-5 py-5 text-left transition hover:bg-dashboard-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-dashboard-accent ${
                  notification.is_read ? 'bg-transparent' : 'bg-[#091a27]'
                }`}
                key={notification.id}
                onClick={() => void openNotification(notification)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`mt-[21px] h-2 w-2 rounded-full ${
                    notification.is_read ? 'bg-transparent' : 'bg-[var(--blue)]'
                  }`}
                />
                <span className={`grid h-11 w-11 place-items-center rounded-full ${iconClasses}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-sm font-semibold leading-5 text-dashboard-text">
                    {copy.title}
                  </span>
                  {copy.description ? (
                    <span className="mt-1 block text-sm leading-5 text-dashboard-muted">
                      {copy.description}
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-col items-center gap-2 pt-0.5 text-dashboard-subtle">
                  <span className="text-[11px]">{formatRelativeTime(notification.created_at)}</span>
                  <MoreHorizontalIcon className="h-5 w-5" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
