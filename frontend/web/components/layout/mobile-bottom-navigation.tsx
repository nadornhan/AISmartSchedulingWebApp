'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type SVGProps } from 'react';
import {
  CalendarIcon,
  CloseIcon,
  FolderIcon,
  FocusIcon,
  InsightsIcon,
  PlusIcon,
  PriorityIcon,
  SettingsIcon,
  TasksIcon,
} from './icons';

type NavIconProps = SVGProps<SVGSVGElement>;

function HomeIcon(props: NavIconProps) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" {...props}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function MoreHorizontalIcon(props: NavIconProps) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

const primaryItems = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/tasks', label: 'Tasks', icon: TasksIcon },
  { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
] as const;

const moreItems = [
  { href: '/priority', label: 'Priority', icon: PriorityIcon },
  { href: '/focus', label: 'Focus', icon: FocusIcon },
  { href: '/folders', label: 'Folders', icon: FolderIcon },
  { href: '/analytics', label: 'AI Insights', icon: InsightsIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
] as const;

function routeIsActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);

  function openCreateTask() {
    if (pathname === '/tasks') {
      window.dispatchEvent(new CustomEvent('open-create-task', { detail: { projectId: null } }));
      return;
    }
    router.push('/tasks?create=1');
  }

  const moreIsActive = moreItems.some((item) => routeIsActive(pathname, item.href));

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-[180] lg:hidden">
          <button aria-label="Close more navigation" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} type="button" />
          <section aria-label="More navigation" className="absolute inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] rounded-2xl border border-dashboard-border bg-[#07151f] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <h2 className="text-sm font-semibold text-dashboard-text">More</h2>
              <button aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full text-dashboard-muted hover:bg-dashboard-surface hover:text-dashboard-text" onClick={() => setMoreOpen(false)} type="button">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const active = routeIsActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link aria-current={active ? 'page' : undefined} className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-sm transition ${active ? 'bg-dashboard-accent-soft text-dashboard-accent' : 'text-dashboard-muted hover:bg-dashboard-surface hover:text-dashboard-text'}`} href={item.href} key={item.href}>
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-[190] border-t border-dashboard-border bg-[#04111a]/95 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          {primaryItems.slice(0, 2).map((item) => {
            const active = routeIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition ${active ? 'text-dashboard-accent' : 'text-dashboard-subtle hover:text-dashboard-text'}`} href={item.href} key={item.href}>
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button aria-label="Create task" className="group flex min-h-16 flex-col items-center justify-end" onClick={openCreateTask} type="button">
            <span className="grid h-16 w-16 -translate-y-3 place-items-center rounded-full border-[5px] border-[#04111a] bg-gradient-to-br from-dashboard-accent to-dashboard-accent-strong text-[#032219] shadow-[0_10px_24px_rgba(32,201,157,0.28)] transition group-active:scale-95">
              <PlusIcon className="h-8 w-8" />
            </span>
          </button>

          {primaryItems.slice(2).map((item) => {
            const active = routeIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link aria-current={active ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition ${active ? 'text-dashboard-accent' : 'text-dashboard-subtle hover:text-dashboard-text'}`} href={item.href} key={item.href}>
                <Icon className="h-6 w-6" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button aria-expanded={moreOpen} aria-haspopup="dialog" className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs transition ${moreIsActive || moreOpen ? 'text-dashboard-accent' : 'text-dashboard-subtle hover:text-dashboard-text'}`} onClick={() => setMoreOpen(true)} type="button">
            <MoreHorizontalIcon className="h-6 w-6" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
