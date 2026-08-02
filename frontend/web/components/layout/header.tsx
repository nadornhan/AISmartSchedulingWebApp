'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { HeaderDropdown } from './header-dropdown';
import { BellIcon, ChevronDownIcon, SearchIcon } from './icons';
import { NotificationDropdown, type NotificationDropdownItem } from './notification-dropdown';
import { ProfileMenu } from './profile-menu';
import type { UserResponse } from '../../lib/auth';
import { onTaskDataChanged } from '../../lib/data-events';
import {
  listNotifications,
  markNotificationsRead,
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
        'relative z-[100] flex min-h-28 flex-col gap-6 border-b border-dashboard-border bg-dashboard-bg/75 px-6 py-6 backdrop-blur-xl lg:px-10 xl:px-12',
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

        <div className="hidden shrink-0 items-center gap-6 md:flex">
          <SearchBox />
          <HeaderActions user={user} />
        </div>
      </div>

      <div className="flex items-center gap-4 md:hidden">
        <SearchBox compact />
        <HeaderActions compact user={user} />
      </div>
    </header>
  );
}

function SearchBox({ compact = false }: Readonly<{ compact?: boolean }>) {
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
        'flex h-14 items-center rounded-lg border border-dashboard-border bg-dashboard-surface/55 text-dashboard-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition focus-within:border-dashboard-accent/60',
        compact ? 'min-w-0 flex-1 px-4' : 'w-[420px] px-5',
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
        placeholder="Search tasks..."
        type="search"
        value={search}
      />
    </form>
  );
}

function HeaderActions({
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

    async function loadAndMarkDisplayed() {
      setNotificationsLoading(true);
      const response = await refreshNotifications(controller.signal);
      const unreadIds =
        response?.items.filter((item) => !item.is_read).map((item) => item.id) ?? [];

      if (unreadIds.length > 0) {
        try {
          const nextNotifications = await markNotificationsRead(unreadIds, {
            signal: controller.signal,
          });
          setNotifications(nextNotifications);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            setNotificationsError(
              error instanceof Error ? error.message : 'Unable to update notifications.',
            );
          }
        }
      }

      if (!controller.signal.aborted) {
        setNotificationsLoading(false);
      }
    }

    void loadAndMarkDisplayed();

    return () => controller.abort();
  }, [openMenu, refreshNotifications]);

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
    <div className={cn('relative flex items-center', compact ? 'gap-3' : 'gap-6')}>
      <button
        aria-expanded={openMenu === 'notifications'}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className="relative grid h-12 w-12 place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
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
          className="h-12 w-12"
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
            isLoading={notificationsLoading}
            items={notificationItems}
            onClose={() => setOpenMenu(null)}
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
