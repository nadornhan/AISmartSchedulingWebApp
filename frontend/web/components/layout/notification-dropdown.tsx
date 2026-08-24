'use client';

import type { ReactNode } from 'react';
import type { NotificationType } from '../../lib/notifications';
import { BellIcon, CalendarIcon, CheckIcon, FocusIcon, TasksIcon } from './icons';

export type NotificationDropdownItem = {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  isRead: boolean;
  onSelect?: () => void;
  type: NotificationType;
  typeLabel: string;
};

type NotificationDropdownProps = {
  error?: string | null;
  isLoading?: boolean;
  isMarkingAllRead?: boolean;
  items?: NotificationDropdownItem[];
  onClose: () => void;
  onMarkAllRead?: () => void;
  unreadCount?: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function notificationIcon(type: NotificationType): ReactNode {
  const className = 'h-4 w-4';

  if (type === 'task_reminder' || type === 'task_rescheduled') {
    return <CalendarIcon className={className} />;
  }

  if (type === 'overdue_alert') {
    return <BellIcon className={className} />;
  }

  if (type === 'productivity_reminder') {
    return <FocusIcon className={className} />;
  }

  if (type === 'task_created') {
    return <TasksIcon className={className} />;
  }

  return <CheckIcon className={className} />;
}

function notificationTone(type: NotificationType) {
  if (type === 'overdue_alert') {
    return 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]';
  }

  if (type === 'task_reminder' || type === 'task_rescheduled') {
    return 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--orange-light)]';
  }

  if (type === 'productivity_reminder') {
    return 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]';
  }

  return 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]';
}

export function NotificationDropdown({
  error = null,
  isLoading = false,
  isMarkingAllRead = false,
  items = [],
  onClose,
  onMarkAllRead,
  unreadCount = 0,
}: NotificationDropdownProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between border-b border-dashboard-border px-2 pb-3">
        <h2 className="text-sm font-semibold text-dashboard-text">Notifications</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && onMarkAllRead ? (
            <button
              className="rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-dashboard-accent transition hover:bg-dashboard-accent-soft disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
              disabled={isLoading || isMarkingAllRead}
              onClick={onMarkAllRead}
              type="button"
            >
              {isMarkingAllRead ? 'Marking...' : 'Mark All as Read'}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2 p-2" aria-busy="true">
          <span className="h-14 animate-pulse rounded-lg bg-dashboard-surface" />
          <span className="h-14 animate-pulse rounded-lg bg-dashboard-surface" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <p
          className="rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="grid min-h-24 place-items-center px-4 text-center">
          <div>
            <p className="text-sm font-medium text-dashboard-text">No notifications yet</p>
            <p className="mt-1 text-xs text-dashboard-muted">New task activity will appear here.</p>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="grid max-h-[min(25rem,calc(100vh-12rem))] gap-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <button
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent',
                item.isRead
                  ? 'border-transparent bg-transparent hover:bg-dashboard-surface'
                  : 'border-dashboard-accent/30 bg-dashboard-accent-soft hover:bg-dashboard-accent-soft/80',
              )}
              key={item.id}
              onClick={() => {
                item.onSelect?.();
                onClose();
              }}
              type="button"
            >
              <span
                className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                  notificationTone(item.type),
                )}
              >
                {notificationIcon(item.type)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-dashboard-raised px-2 py-0.5 text-[11px] font-semibold text-dashboard-muted">
                    {item.typeLabel}
                  </span>
                  {!item.isRead ? (
                    <span className="h-2 w-2 rounded-full bg-dashboard-accent">
                      <span className="sr-only">Unread</span>
                    </span>
                  ) : null}
                  <span className="text-xs text-dashboard-subtle">
                    {formatCreatedAt(item.createdAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 block whitespace-normal break-words text-sm leading-5',
                    item.isRead ? 'font-medium text-dashboard-muted' : 'font-semibold text-dashboard-text',
                  )}
                >
                  {item.title}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block whitespace-normal break-words text-xs leading-5 text-dashboard-muted">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
