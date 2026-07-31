'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BellIcon, ChevronDownIcon, SearchIcon } from './icons';
import type { UserResponse } from '../../lib/auth';

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
        'flex min-h-28 flex-col gap-6 border-b border-dashboard-border bg-dashboard-bg/75 px-6 py-6 backdrop-blur-xl lg:px-10 xl:px-12',
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
      <kbd className="hidden rounded bg-dashboard-raised px-2 py-1 text-xs sm:block">⌘K</kbd>
    </form>
  );
}

function getUserInitials(
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null,
) {
  const firstName = user?.first_name?.trim() ?? "";
  const lastName = user?.last_name?.trim() ?? "";
  const email = user?.email?.trim() ?? "";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return initials || email.slice(0, 2).toUpperCase() || "U";
}

function HeaderActions({
  compact = false,
  user,
}: Readonly<{
  compact?: boolean;
  user?: UserResponse | null;
}>) {
  const initials = getUserInitials(user);

  return (
    <div className={cn('flex items-center', compact ? 'gap-3' : 'gap-6')}>
      <button
        aria-label="Notifications"
        className="relative grid h-12 w-12 place-items-center rounded-full text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
        type="button"
      >
        <BellIcon className="h-6 w-6" />
        <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-dashboard-accent px-1 text-xs font-bold leading-none text-dashboard-bg">
          2
        </span>
      </button>

      <button
        aria-label="Open profile menu"
        className="flex items-center gap-3 rounded-full text-dashboard-muted transition hover:text-dashboard-text"
        type="button"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-dashboard-border-strong bg-gradient-to-br from-dashboard-muted to-dashboard-surface text-sm font-semibold text-dashboard-bg">
          {initials}
        </span>
        <ChevronDownIcon className="hidden h-5 w-5 shrink-0 sm:block" />
      </button>
    </div>
  );
}
