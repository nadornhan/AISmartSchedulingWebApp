'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { HeaderDropdown } from './header-dropdown';
import { BellIcon, ChevronDownIcon, FilterIcon, SearchIcon } from './icons';
import { NotificationDropdown, type NotificationDropdownItem } from './notification-dropdown';
import { ProfileMenu } from './profile-menu';
import type { UserResponse } from '../../lib/auth';
import { onTaskDataChanged } from '../../lib/data-events';
import {
  listNotifications,
  markAllNotificationsRead,
  type NotificationListResponse,
  type NotificationResponse,
} from '../../lib/notifications';
import { UserAvatar } from '../shared/user-avatar';

type HeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
  user?: UserResponse | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Header({ title, subtitle, className, user }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-[180] hidden min-h-28 flex-col gap-6 border-b border-dashboard-border bg-dashboard-bg/90 px-10 py-6 backdrop-blur-xl lg:flex xl:px-12',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate font-poppins text-3xl font-medium leading-tight tracking-normal text-dashboard-text">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-base leading-6 text-dashboard-muted">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <SearchBox />
          <HeaderActions user={user} />
        </div>
      </div>
    </header>
  );
}

export function SearchBox({
  compact = false,
  showFilterButton = false,
}: Readonly<{
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
        'flex h-14 items-center border border-dashboard-border bg-dashboard-surface/55 text-dashboard-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition focus-within:border-dashboard-accent/60',
        compact ? 'w-full rounded-2xl px-4' : 'w-[420px] rounded-lg px-5',
      )}
      onSubmit={handleSubmit}
      role="search"
    >
      <SearchIcon className="h-5 w-5 shrink-0" />
      <label className="sr-only" htmlFor={compact ? 'mobile-task-search' : 'desktop-task-search'}>
        Search tasks
      </label>
      <input
        className="min-w-0 flex-1 border-0 bg-transparent pl-4 text-base font-medium text-dashboard-text outline-none placeholder:text-dashboard-muted"
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
  user,
}: Readonly<{
  compact?: boolean;
  user?: UserResponse | null;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null);
  const [notifications, setNotifications] = useState<NotificationListResponse>({
    items: [],
    unread_count: 0,
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const refreshNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      setNotificationsError(null);
      const response = await listNotifications(5, { signal });
      setNotifications(response);
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
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
    onSelect: () => {
      const projectId = notification.task?.project_id;
      router.push(projectId ? `/tasks?project_id=${encodeURIComponent(projectId)}` : '/tasks');
    },
  }));

  return (
    <div className={cn('relative flex items-center', compact ? 'gap-1' : 'gap-6')}>
      <button
        aria-expanded={openMenu === 'notifications'}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className={cn(
          'relative grid place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent',
          compact ? 'h-11 w-11' : 'h-12 w-12',
        )}
        onClick={() =>
          setOpenMenu((current) => (current === 'notifications' ? null : 'notifications'))
        }
        ref={notificationButtonRef}
        type="button"
      >
        <BellIcon className="h-6 w-6" />
        {notifications.unread_count > 0 ? (
          <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-dashboard-danger px-1.5 text-center text-xs font-semibold leading-5 text-white">
            {notifications.unread_count > 99 ? '99+' : notifications.unread_count}
          </span>
        ) : null}
      </button>

      <button
        aria-expanded={openMenu === 'profile'}
        aria-haspopup="dialog"
        aria-label="Open profile menu"
        className="flex items-center gap-3 rounded-full text-dashboard-muted transition hover:text-dashboard-text"
        onClick={() => setOpenMenu((current) => (current === 'profile' ? null : 'profile'))}
        ref={profileButtonRef}
        type="button"
      >
        <UserAvatar
          avatarUrl={user?.avatar_url}
          className={compact ? 'h-11 w-11' : 'h-12 w-12'}
          email={user?.email}
          firstName={user?.first_name}
          lastName={user?.last_name}
        />
        <ChevronDownIcon className="hidden h-5 w-5 shrink-0 sm:block" />
      </button>

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

      {openMenu === 'profile' ? (
        <HeaderDropdown
          label="Profile menu"
          onClose={() => setOpenMenu(null)}
          triggerRef={profileButtonRef}
        >
          <ProfileMenu onClose={() => setOpenMenu(null)} user={user} />
        </HeaderDropdown>
      ) : null}
    </div>
  );
}
