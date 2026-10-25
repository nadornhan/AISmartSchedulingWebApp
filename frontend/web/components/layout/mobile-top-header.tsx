'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { HeaderActions } from './header';
import { BellIcon } from './icons';
import type { UserResponse } from '../../lib/auth';

export function MobileTopHeader({
  title,
  totalXp,
  user,
}: Readonly<{
  title: string;
  totalXp?: number | null;
  user?: UserResponse | null;
}>) {
  if (title === 'Account') {
    return (
      <header className="bg-dashboard-bg px-6 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-poppins text-2xl font-semibold text-dashboard-text">Account</h1>
          <HeaderActions compact showXp totalXp={totalXp} user={user} />
        </div>
      </header>
    );
  }

  if (title === 'Profile') {
    return (
      <header className="bg-dashboard-bg px-6 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] lg:hidden">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2">
          <Link
            aria-label="Back to account"
            className="grid h-11 w-11 place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-accent"
            href="/account"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <h1 className="text-center font-poppins text-xl font-semibold text-dashboard-text">
            {title}
          </h1>
          <span aria-hidden="true" className="size-11" />
        </div>
      </header>
    );
  }

  if (title === 'AI Insights' || title === 'Personal Forest') {
    return (
      <header className="bg-dashboard-bg px-6 pb-3 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            aria-label="Back to account"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-accent"
            href="/account"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 font-poppins text-2xl font-semibold leading-tight text-dashboard-text">
            {title}
          </h1>
        </div>
      </header>
    );
  }

  if (title !== 'Dashboard') {
    return (
      <header className="relative z-[180] bg-[var(--bg-sidebar)]/95 px-6 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h1 className="min-w-0 font-poppins text-2xl font-semibold leading-tight tracking-normal text-dashboard-text">
            {title}
          </h1>
          <Link
            aria-label="Notifications"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-dashboard-border bg-dashboard-surface text-dashboard-text transition hover:bg-dashboard-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            href="/notifications"
          >
            <BellIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>
    );
  }

  return null;
}
