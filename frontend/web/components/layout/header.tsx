'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { HeaderDropdown } from './header-dropdown';
import { BellIcon, CalendarIcon, FilterIcon, LightningIcon, SearchIcon } from './icons';
import { NotificationDropdown, type NotificationDropdownItem } from './notification-dropdown';
import type { UserResponse } from '../../lib/auth';
import { onTaskDataChanged } from '../../lib/data-events';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  notificationTypeLabel,
  type NotificationListResponse,
  type NotificationResponse,
} from '../../lib/notifications';
import { UserAvatar } from '../shared/user-avatar';
import { useDashboardHeading } from './dashboard-heading-context';
import { useUiPreferences } from './ui-preferences-provider';

type HeaderProps = {
  className?: string;
  totalXp?: number | null;
  user?: UserResponse | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Header({ className, totalXp, user }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-[180] hidden h-24 items-center border-b border-dashboard-border bg-dashboard-bg/90 px-10 backdrop-blur-xl lg:flex xl:px-12',
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <SearchBox />
        </div>
        <HeaderActions totalXp={totalXp} user={user} />
      </div>
    </header>
  );
}

export function HeaderDate({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { heading } = useDashboardHeading();
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('en-AU', {
        weekday: compact ? 'short' : 'long',
        day: 'numeric',
        month: compact ? 'short' : 'long',
      }).format(new Date()),
    );
  }, [compact]);

  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium text-dashboard-muted',
        className,
      )}
    >
      <CalendarIcon className="h-4 w-4 shrink-0 text-dashboard-accent" />
      {heading?.date ?? today}
    </p>
  );
}

export function SearchBox({
  autoFocus = false,
  compact = false,
  showFilterButton = false,
}: Readonly<{
  autoFocus?: boolean;
  compact?: boolean;
  showFilterButton?: boolean;
}>) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/tasks?search=${encodeURIComponent(query)}` : '/tasks');
  }

  return (
    <form
      className={cn(
        'flex items-center border border-dashboard-border bg-dashboard-surface/55 text-dashboard-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition focus-within:border-dashboard-accent/60',
        compact
          ? 'h-14 w-full rounded-xl px-4'
          : 'h-12 min-w-0 w-full max-w-[400px] rounded-lg px-5',
      )}
      onSubmit={handleSubmit}
      role="search"
    >
      <SearchIcon className="h-5 w-5 shrink-0" />
      <label className="sr-only" htmlFor={compact ? 'mobile-task-search' : 'desktop-task-search'}>
        Search tasks
      </label>
      <input
        autoFocus={autoFocus}
        className="chrono-autofill chrono-autofill-search min-w-0 flex-1 self-stretch rounded-[inherit] border-0 bg-transparent pl-4 text-base font-medium text-dashboard-text outline-none placeholder:text-dashboard-muted"
        id={compact ? 'mobile-task-search' : 'desktop-task-search'}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={compact ? 'Search' : 'Search tasks...'}
        type="search"
        value={search}
      />
      {showFilterButton ? (
        <button
          aria-label="Toggle task filters"
          className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-accent-soft hover:text-dashboard-accent"
          onClick={() => window.dispatchEvent(new Event('toggle-mobile-task-filters'))}
          type="button"
        >
          <FilterIcon className="h-5 w-5" />
        </button>
      ) : null}
    </form>
  );
}

export function HeaderActions({
  compact = false,
  showXp = true,
  totalXp,
  user,
}: Readonly<{
  compact?: boolean;
  showXp?: boolean;
  totalXp?: number | null;
  user?: UserResponse | null;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useUiPreferences();
  const themeAction = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  const [openMenu, setOpenMenu] = useState<'notifications' | null>(null);
  const [notifications, setNotifications] = useState<NotificationListResponse>({
    items: [],
    unread_count: 0,
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  const refreshNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      setNotificationsError(null);
      const response = await listNotifications(20, { signal });
      setNotifications(response);
      return response;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return null;
      }

      setNotificationsError(
        error instanceof Error ? error.message : 'Unable to load notifications.',
      );
      return null;
    }
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshNotifications(controller.signal);

    return () => controller.abort();
  }, [refreshNotifications]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshNotifications();
      }),
    [refreshNotifications],
  );

  useEffect(() => {
    function refreshAfterNotificationUpdate() {
      void refreshNotifications();
    }

    window.addEventListener('notifications-updated', refreshAfterNotificationUpdate);
    return () =>
      window.removeEventListener('notifications-updated', refreshAfterNotificationUpdate);
  }, [refreshNotifications]);

  useEffect(() => {
    if (openMenu !== 'notifications') return;

    const controller = new AbortController();

    async function loadNotifications() {
      setNotificationsLoading(true);
      await refreshNotifications(controller.signal);

      if (!controller.signal.aborted) {
        setNotificationsLoading(false);
      }
    }

    void loadNotifications();

    return () => controller.abort();
  }, [openMenu, refreshNotifications]);

  async function markAllRead() {
    if (isMarkingAllRead || notifications.unread_count === 0) return;

    setIsMarkingAllRead(true);
    setNotificationsError(null);

    try {
      const nextNotifications = await markAllNotificationsRead();
      setNotifications(nextNotifications);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : 'Unable to update notifications.',
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  }

  async function selectNotification(notification: NotificationResponse) {
    if (!notification.is_read) {
      setNotifications((current) => ({
        items: current.items.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item,
        ),
        unread_count: Math.max(0, current.unread_count - 1),
      }));
    }

    router.push(notification.target_url);

    if (notification.is_read) return;

    try {
      const nextNotifications = await markNotificationsRead([notification.id]);
      setNotifications(nextNotifications);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : 'Unable to update notifications.',
      );
      void refreshNotifications();
    }
  }

  function notificationDescription(notification: NotificationResponse) {
    const details = [
      notification.task?.project_name,
      notification.task?.priority,
      notification.task?.status,
    ].filter(Boolean);

    return details.length > 0 ? details.join(' / ') : undefined;
  }

  const notificationItems: NotificationDropdownItem[] = notifications.items.map((notification) => ({
    id: notification.id,
    title: notification.message ?? notification.title,
    description: notificationDescription(notification),
    createdAt: notification.created_at,
    isRead: notification.is_read,
    type: notification.type,
    typeLabel: notificationTypeLabel(notification.type),
    onSelect: () => {
      void selectNotification(notification);
    },
  }));

  return (
    <div
      className={cn(
        'relative shrink-0 items-center',
        compact ? 'flex gap-2' : 'flex gap-3 xl:gap-4',
      )}
    >
      {!compact ? (
        <HeaderDate className="mr-2 whitespace-nowrap border-r border-dashboard-border py-1 pr-5" />
      ) : null}
      {showXp && user ? (
        <span
          aria-label={
            totalXp == null
              ? 'Accumulated XP unavailable'
              : `${totalXp.toLocaleString('en-AU')} accumulated XP`
          }
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--achievement-gold-border)] bg-[var(--achievement-gold-soft)] font-semibold tabular-nums text-[var(--achievement-gold-text)]',
            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          )}
          title="Total accumulated XP (Growth Points)"
        >
          <LightningIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          {totalXp == null ? '—' : totalXp.toLocaleString('en-AU')} XP
        </span>
      ) : null}
      {!compact ? (
        <button
          aria-label={themeAction}
          className={cn(
            'grid shrink-0 place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent',
            'h-11 w-11',
          )}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={themeAction}
          type="button"
        >
          {theme === 'dark' ? (
            <Sun aria-hidden="true" size={22} />
          ) : (
            <Moon aria-hidden="true" size={22} />
          )}
        </button>
      ) : null}
      <button
        aria-expanded={compact ? undefined : openMenu === 'notifications'}
        aria-haspopup={compact ? undefined : 'dialog'}
        aria-label="Notifications"
        className={cn(
          'relative grid place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent',
          'h-11 w-11',
        )}
        onClick={() => {
          if (compact) {
            router.push('/notifications');
            return;
          }
          setOpenMenu((current) => (current === 'notifications' ? null : 'notifications'));
        }}
        ref={notificationButtonRef}
        type="button"
      >
        <BellIcon className="h-5 w-5" />
        {notifications.unread_count > 0 ? (
          compact ? (
            <span
              aria-label={`${notifications.unread_count} unread notifications`}
              className="absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-sidebar)] bg-[var(--orange)]"
            />
          ) : (
            <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-dashboard-danger px-1.5 text-center text-xs font-semibold leading-5 text-white">
              {notifications.unread_count > 99 ? '99+' : notifications.unread_count}
            </span>
          )
        ) : null}
      </button>

      {!compact ? (
        <button
          aria-label="Open profile"
          className="flex items-center gap-3 rounded-full text-dashboard-muted transition hover:text-dashboard-text"
          onClick={() => router.push('/profile')}
          type="button"
        >
          <UserAvatar
            avatarUrl={user?.avatar_url}
            className="h-11 w-11"
            email={user?.email}
            firstName={user?.first_name}
            lastName={user?.last_name}
          />
        </button>
      ) : null}

      {openMenu === 'notifications' ? (
        <HeaderDropdown
          label="Notifications"
          onClose={() => setOpenMenu(null)}
          triggerRef={notificationButtonRef}
        >
          <NotificationDropdown
            error={notificationsError}
            isMarkingAllRead={isMarkingAllRead}
            isLoading={notificationsLoading}
            items={notificationItems}
            onClose={() => setOpenMenu(null)}
            onMarkAllRead={() => void markAllRead()}
            unreadCount={notifications.unread_count}
          />
        </HeaderDropdown>
      ) : null}
    </div>
  );
}
