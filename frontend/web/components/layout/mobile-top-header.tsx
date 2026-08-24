'use client';

import Link from 'next/link';

import type { UserResponse } from '../../lib/auth';
import { HeaderActions, SearchBox } from './header';

export function MobileTopHeader({
  title,
  user,
}: Readonly<{
  title: string;
  user?: UserResponse | null;
}>) {
  const isTaskPage = title === 'All Tasks';
  const isCalendarPage = title === 'Calendar';
  const isNotificationsPage = title === 'Notifications';
  const isFocusPage = title === 'Focus Mode';
  const isProfilePage = title === 'Profile';
  const showPageTitle =
    isTaskPage || isCalendarPage || isNotificationsPage || isFocusPage || isProfilePage;
  const hideSearch = isCalendarPage || isNotificationsPage || isFocusPage || isProfilePage;

  return (
    <header className="relative z-[180] border-b border-dashboard-border bg-[#04111a]/95 px-6 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
      <div className="mx-auto max-w-lg">
        <div
          className={`flex items-center justify-between gap-5 ${
            hideSearch ? '' : 'mb-6'
          }`}
        >
          {showPageTitle ? (
            <h1 className="font-poppins text-2xl font-semibold text-dashboard-text">
              {isTaskPage
                ? 'Tasks'
                : isNotificationsPage
                  ? 'Notification'
                  : isFocusPage
                    ? 'Focus'
                    : title}
            </h1>
          ) : (
            <Link
              aria-label="Chrono dashboard"
              className="inline-flex min-w-0 items-center gap-2.5"
              href="/"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full shadow-glow">
                <img alt="" className="h-full w-full object-contain" src="/chrono-logo.svg" />
              </span>
              <span className="truncate font-poppins text-[28px] font-semibold leading-none text-dashboard-text">
                Chrono
              </span>
            </Link>
          )}

          <HeaderActions compact user={user} />
        </div>

        {!hideSearch ? (
          <SearchBox compact showFilterButton={isTaskPage} />
        ) : null}
      </div>
    </header>
  );
}
