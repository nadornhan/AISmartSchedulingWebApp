'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SVGProps } from 'react';
import { CircleUserRound } from 'lucide-react';
import {
  CalendarIcon,
  PlusIcon,
  TasksIcon,
} from './icons';

type NavIconProps = SVGProps<SVGSVGElement>;

function HomeIcon(props: NavIconProps) {
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
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

const primaryItems = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/tasks', label: 'Tasks', icon: TasksIcon },
  { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
] as const;

const accountRoutes = ['/account', '/analytics', '/gamification', '/profile'];

function routeIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  function openCreateTask() {
    if (pathname === '/tasks') {
      window.dispatchEvent(new CustomEvent('open-create-task', { detail: { projectId: null } }));
      return;
    }
    router.push('/tasks?create=1');
  }

  const accountIsActive = accountRoutes.some((href) => routeIsActive(pathname, href));

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[190] border-t border-dashboard-border bg-[var(--bg-sidebar)] px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgb(var(--shadow-color)/calc(0.18*var(--shadow-strength)))] lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {primaryItems.slice(0, 2).map((item) => {
            const active = routeIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition ${active ? 'text-dashboard-accent' : 'text-dashboard-subtle hover:text-dashboard-text'}`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            aria-label="Create task"
            className="group flex min-h-16 flex-col items-center justify-end"
            onClick={openCreateTask}
            type="button"
          >
            <span className="grid h-16 w-16 -translate-y-3 place-items-center rounded-full border-[5px] border-[var(--bg-sidebar)] bg-gradient-to-br from-dashboard-accent to-dashboard-accent-strong text-dashboard-on-accent shadow-[0_10px_24px_rgba(32,201,157,0.28)] transition group-active:scale-95">
              <PlusIcon className="h-8 w-8" />
            </span>
          </button>

          {primaryItems.slice(2).map((item) => {
            const active = routeIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition ${active ? 'text-dashboard-accent' : 'text-dashboard-subtle hover:text-dashboard-text'}`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <Link
            aria-current={accountIsActive ? 'page' : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition ${accountIsActive ? 'text-dashboard-accent' : 'text-dashboard-subtle hover:text-dashboard-text'}`}
            href="/account"
          >
            <CircleUserRound aria-hidden="true" className="h-6 w-6" />
            <span>Account</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
