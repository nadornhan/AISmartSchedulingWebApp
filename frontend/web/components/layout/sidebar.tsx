'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DashboardIcon,
  FocusIcon,
  FolderIcon,
  GamificationIcon,
  InsightsIcon,
  PlusIcon,
  PriorityIcon,
  SettingsIcon,
  TasksIcon,
} from './icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  href: string;
  label: string;
  icon: IconComponent;
  badge?: string;
  exact?: boolean;
};

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

const generalNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon, exact: true },
  { href: '/tasks', label: 'All Tasks', icon: TasksIcon, badge: '24' },
  { href: '/priority', label: 'Priority View', icon: PriorityIcon },
  { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { href: '/focus', label: 'Focus Mode', icon: FocusIcon },
  { href: '/analytics', label: 'Insights', icon: InsightsIcon },
  { href: '/gamification', label: 'Gamification', icon: GamificationIcon },
];

const folders = [
  { name: 'Work', count: 8, color: 'bg-dashboard-danger' },
  { name: 'Personal', count: 5, color: 'bg-dashboard-info' },
  { name: 'Study', count: 3, color: 'bg-dashboard-warning' },
  { name: 'Health', count: 3, color: 'bg-dashboard-accent' },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function BrandMark() {
  return (
    <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full shadow-glow">
      <img alt="" className="h-full w-full object-contain" src="/chrono-logo.svg" />
    </div>
  );
}

function SectionTitle({
  children,
  actionLabel,
}: Readonly<{
  children: ReactNode;
  actionLabel?: string;
}>) {
  return (
    <div className="mb-4 flex items-center justify-between px-3">
      <p className="text-xs font-semibold uppercase tracking-[0.02em] text-dashboard-muted">
        {children}
      </p>
      {actionLabel ? (
        <button
          aria-label={actionLabel}
          className="grid h-9 w-9 place-items-center rounded-full border border-dashboard-border bg-dashboard-surface text-dashboard-text transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
          type="button"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: Readonly<{
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}>) {
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-12 items-center gap-4 rounded-lg px-3 text-[15px] font-medium transition',
        active
          ? 'bg-gradient-to-r from-dashboard-accent/95 to-dashboard-accent-strong/70 text-dashboard-text shadow-glow'
          : 'text-dashboard-muted hover:bg-dashboard-surface hover:text-dashboard-text',
      )}
      href={item.href}
      onClick={onNavigate}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition',
          active ? 'text-dashboard-text' : 'text-dashboard-muted group-hover:text-dashboard-accent',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-semibold leading-none',
            active
              ? 'bg-dashboard-bg/25 text-dashboard-text'
              : 'bg-dashboard-accent-soft text-dashboard-accent',
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const foldersActive = pathname === '/folders' || pathname.startsWith('/folders/');
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/');

  return (
    <aside
      className={cn(
        'flex h-dvh w-80 flex-col overflow-y-auto border-r border-dashboard-border bg-[#03101a]/95 px-6 py-7 text-dashboard-text shadow-panel backdrop-blur-xl',
        className,
      )}
    >
      <div className="mb-8 flex items-center gap-3">
        <BrandMark />
        <span className="text-3xl font-semibold leading-none tracking-normal">Chrono</span>
      </div>

      <button className="mb-10 flex h-14 items-center justify-between rounded-lg bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-6 text-base font-semibold text-white shadow-glow transition hover:brightness-110" type="button">
        <span className="flex items-center gap-4">
          <PlusIcon className="h-6 w-6" />
          Add task
        </span>
        <ChevronDownIcon className="h-5 w-5" />
      </button>

      <nav aria-label="Main navigation" className="space-y-8">
        <section>
          <SectionTitle>General</SectionTitle>
          <div className="space-y-1.5">
            {generalNavItems.map((item) => (
              <NavLink
                active={isActive(pathname, item)}
                item={item}
                key={item.href}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle actionLabel="Add folder">Projects / Folders</SectionTitle>
          <div className="space-y-1.5">
            <NavLink
              active={foldersActive}
              item={{ href: '/folders', label: 'Folders', icon: FolderIcon }}
              onNavigate={onNavigate}
            />

            <div className="pt-1">
              {folders.map((folder) => (
                <Link
                  className="group flex h-11 items-center gap-4 rounded-lg px-3 text-[15px] font-medium text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-text"
                  href={`/folders?folder=${encodeURIComponent(folder.name.toLowerCase())}`}
                  key={folder.name}
                  onClick={onNavigate}
                >
                  <span className={cn('h-5 w-5 shrink-0 rounded-full', folder.color)} />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="rounded-full bg-dashboard-surface px-2.5 py-1 text-sm font-semibold leading-none text-dashboard-text group-hover:text-dashboard-accent">
                    {folder.count}
                  </span>
                </Link>
              ))}

              <button className="mt-1 flex h-11 w-full items-center gap-4 rounded-lg px-3 text-left text-[15px] font-medium text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-accent" type="button">
                <PlusIcon className="h-5 w-5 shrink-0" />
                <span>New Folder</span>
              </button>
            </div>
          </div>
        </section>
      </nav>

      <div className="mt-auto pt-8">
        <div className="mb-6 overflow-hidden rounded-lg border border-dashboard-border bg-dashboard-surface/80 p-5">
          <p className="text-base font-semibold text-dashboard-text">Keep going!</p>
          <p className="mt-3 text-sm leading-6 text-dashboard-muted">
            Small progress every day leads to big results.
          </p>
          <div className="mt-6 h-20 rounded-lg bg-gradient-to-br from-dashboard-accent-soft via-transparent to-dashboard-accent/30" />
        </div>

        <Link
          aria-current={settingsActive ? 'page' : undefined}
          className={cn(
            'flex h-12 items-center gap-4 rounded-lg border-t border-dashboard-border px-2 pt-4 text-[15px] font-medium transition',
            settingsActive ? 'text-dashboard-accent' : 'text-dashboard-muted hover:text-dashboard-text',
          )}
          href="/settings"
          onClick={onNavigate}
        >
          <SettingsIcon className="h-5 w-5 shrink-0" />
          <span className="flex-1">Settings</span>
          <ChevronRightIcon className="h-5 w-5" />
        </Link>
      </div>
    </aside>
  );
}
