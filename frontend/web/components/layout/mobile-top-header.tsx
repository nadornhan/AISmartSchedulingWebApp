'use client';

import { useEffect, useState } from 'react';

import { SearchBox } from './header';
import { SearchIcon } from './icons';

export function MobileTopHeader({
  title,
}: Readonly<{
  title: string;
}>) {
  const [searchOpen, setSearchOpen] = useState(false);
  const isTaskPage = title === 'All Tasks';

  useEffect(() => setSearchOpen(false), [title]);

  if (title !== 'Dashboard') {
    return (
      <header className="relative z-[180] bg-[var(--bg-sidebar)]/95 px-6 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h1 className="min-w-0 font-poppins text-2xl font-normal leading-tight tracking-normal text-dashboard-text">
            {title}
          </h1>
          <button
            aria-controls="mobile-page-search"
            aria-expanded={searchOpen}
            aria-label="Search tasks"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-dashboard-border bg-dashboard-surface text-dashboard-text transition hover:bg-dashboard-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            onClick={() => setSearchOpen((open) => !open)}
            type="button"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
        </div>
        {searchOpen ? (
          <div
            className="mt-4"
            id="mobile-page-search"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
            }}
          >
            <SearchBox autoFocus compact showFilterButton={isTaskPage} />
          </div>
        ) : null}
      </header>
    );
  }

  return null;
}
