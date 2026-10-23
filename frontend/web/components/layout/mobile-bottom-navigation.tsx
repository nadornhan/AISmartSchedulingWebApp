'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CircleUserRound, House, ListTodo, Plus } from 'lucide-react';
import { CalendarIcon } from './icons';

const primaryItems = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/tasks', label: 'Tasks', icon: ListTodo },
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
        className="fixed inset-x-0 bottom-0 z-[190] border-t border-dashboard-border bg-[var(--bg-sidebar)] px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {primaryItems.slice(0, 2).map((item) => {
            const active = routeIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${active ? 'text-dashboard-accent' : 'text-dashboard-muted hover:text-dashboard-text'}`}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            aria-label="Create task"
            className="group flex min-h-16 flex-col items-center justify-end rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
            onClick={openCreateTask}
            type="button"
          >
            <span className="grid h-16 w-16 -translate-y-3 place-items-center rounded-full border-[5px] border-[var(--bg-sidebar)] bg-dashboard-accent text-dashboard-on-accent shadow-[0_8px_20px_rgba(32,201,157,0.18)] transition group-hover:bg-dashboard-accent-strong group-active:scale-95">
              <Plus aria-hidden="true" className="h-8 w-8" strokeWidth={1.8} />
            </span>
          </button>

          {primaryItems.slice(2).map((item) => {
            const active = routeIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${active ? 'text-dashboard-accent' : 'text-dashboard-muted hover:text-dashboard-text'}`}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <Link
            aria-current={accountIsActive ? 'page' : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent ${accountIsActive ? 'text-dashboard-accent' : 'text-dashboard-muted hover:text-dashboard-text'}`}
            href="/account"
          >
            <CircleUserRound aria-hidden="true" className="h-6 w-6" strokeWidth={1.8} />
            <span>Account</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
