'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDashboardHeading } from './dashboard-heading-context';
import { useUiPreferences } from './ui-preferences-provider';

export function PageHeading({
  title,
  subtitle,
  mobileTitleInHeader = false,
  mobileActions,
  mobileSearch,
}: {
  title: string;
  subtitle?: string;
  mobileTitleInHeader?: boolean;
  mobileActions?: ReactNode;
  mobileSearch?: ReactNode;
}) {
  const { heading, setActionsTarget } = useDashboardHeading();
  const { theme } = useUiPreferences();
  const message = heading?.message ?? subtitle;
  const greetingParts = heading?.greeting.match(/^(Good (?:morning|afternoon|evening)),\s*(.+)$/);

  return (
    <header
      className={`${mobileTitleInHeader ? 'mb-0 lg:mb-6' : 'mb-6'} flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6`}
    >
      <div className={`min-w-0 w-full lg:w-auto ${mobileTitleInHeader ? 'hidden lg:block' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-poppins text-lg font-normal leading-tight tracking-normal text-dashboard-text sm:text-3xl lg:text-4xl lg:font-medium">
            {greetingParts ? (
              <>
                <span className="flex items-center gap-3 lg:hidden">
                  <img
                    alt="Chrono"
                    className="h-11 w-11 shrink-0 object-contain"
                    src={theme === 'light' ? '/chrono-logo-light.png' : '/chrono-logo.png'}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-normal leading-5 text-dashboard-muted">
                      {greetingParts[1]},
                    </span>
                    <span className="mt-0.5 block text-lg font-medium leading-tight text-dashboard-text">
                      {greetingParts[2]}
                    </span>
                  </span>
                </span>
                <span className="hidden lg:inline">{heading?.greeting}</span>
              </>
            ) : (
              (heading?.greeting ?? title)
            )}
          </h1>
          {mobileActions ? <div className="shrink-0 lg:hidden">{mobileActions}</div> : null}
        </div>
        {mobileSearch ? <div className="mt-4 lg:hidden">{mobileSearch}</div> : null}
        {heading?.mobileCard ? <div className="mt-5 lg:hidden">{heading.mobileCard}</div> : null}
        {message ? (
          <p
            className={`${heading?.mobileCard || greetingParts ? 'hidden lg:block ' : ''}mt-2 text-sm leading-6 text-dashboard-muted sm:text-base`}
          >
            {message}
          </p>
        ) : null}
      </div>
      <div
        className={`${mobileTitleInHeader ? 'mb-5 lg:mb-0 ' : ''}shrink-0 empty:hidden`}
        ref={setActionsTarget}
      />
    </header>
  );
}

export function PageHeadingActions({ children }: { children: ReactNode }) {
  const { actionsTarget } = useDashboardHeading();
  return actionsTarget ? createPortal(children, actionsTarget) : null;
}
