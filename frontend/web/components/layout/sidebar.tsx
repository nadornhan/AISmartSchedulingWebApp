'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { listProjects, type Project } from '../../lib/projects';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listTasks } from '../../lib/tasks';

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
  { href: '/tasks', label: 'All Tasks', icon: TasksIcon },
  { href: '/priority', label: 'Priority View', icon: PriorityIcon },
  { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { href: '/focus', label: 'Focus Mode', icon: FocusIcon },
  { href: '/analytics', label: 'AI Insights', icon: InsightsIcon },
  { href: '/gamification', label: 'Personal Forest', icon: GamificationIcon },
];

const foldersNavItem: NavItem = {
  href: '/folders',
  label: 'Folders',
  icon: FolderIcon,
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function useScrollFeedback<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      element.classList.add('is-scrolling');

      clearTimeout(scrollTimeout);

      scrollTimeout = setTimeout(() => {
        element.classList.remove('is-scrolling');
      }, 500);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  return ref;
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
  onAction,
  href,
  onNavigate,
}: Readonly<{
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  href?: string;
  onNavigate?: () => void;
}>) {
  const titleClassName =
    'text-[13px] font-normal uppercase tracking-[0.02em] text-dashboard-muted transition hover:text-dashboard-accent';

  return (
    <div className="mb-2 flex items-center justify-between px-3">
      {href ? (
        <Link href={href} onClick={onNavigate} className={titleClassName}>
          {children}
        </Link>
      ) : (
        <p className={titleClassName}>{children}</p>
      )}

      {actionLabel && onAction ? (
        <button
          aria-label={actionLabel}
          className="grid h-9 w-9 place-items-center rounded-full border border-dashboard-border bg-dashboard-surface text-dashboard-text transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
          onClick={onAction}
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
        'group flex h-12 items-center gap-4 rounded-lg px-3 text-[15px] font-normal transition-shadow',
        active
          ? 'border-l-4 border-l-dashboard-accent bg-dashboard-accent/20 text-dashboard-accent'
          : 'border border-transparent text-dashboard-muted hover:border-dashboard-border hover:bg-dashboard-surface hover:text-dashboard-accent',
      )}
      href={item.href}
      onClick={onNavigate}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition',
          active
            ? 'text-dashboard-accent'
            : 'text-dashboard-muted group-hover:text-dashboard-accent',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium leading-none',
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get('project_id');
  const foldersActive = pathname === '/folders' || pathname.startsWith('/folders/');
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/');
  const sidebarRef = useScrollFeedback<HTMLElement>();
  const folderListRef = useScrollFeedback<HTMLDivElement>();
  const [folders, setFolders] = useState<Project[]>([]);
  const [allTasksCount, setAllTasksCount] = useState<number | null>(null);

  const refreshNavigationData = useCallback(async () => {
    try {
      const [projects, taskResult] = await Promise.all([
        listProjects(),
        listTasks({ page: 1, pageSize: 1 }),
      ]);

      setFolders(projects);
      setAllTasksCount(taskResult.total);
    } catch {
      setFolders([]);
      setAllTasksCount(null);
    }
  }, []);

  useEffect(() => {
    void refreshNavigationData();
  }, [pathname, refreshNavigationData]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshNavigationData();
      }),
    [refreshNavigationData],
  );

  useEffect(
    () =>
      onProjectDataChanged(() => {
        void refreshNavigationData();
      }),
    [refreshNavigationData],
  );

  function openCreateFolderModal() {
    if (foldersActive) {
      window.dispatchEvent(new Event('open-create-folder'));
      return;
    }

    router.push('/folders#create-folder');
    onNavigate?.();
  }

  function openCreateTaskModal(projectId?: string | null) {
    const params = new URLSearchParams();
    if (projectId) {
      params.set('project_id', projectId);
    }
    params.set('create', '1');
    const query = params.toString();
    const target = query ? `/tasks?${query}` : '/tasks?create=1';

    if (pathname === '/tasks') {
      window.dispatchEvent(
        new CustomEvent('open-create-task', {
          detail: { projectId: projectId || activeProjectId || null },
        }),
      );
      if (projectId && projectId !== activeProjectId) {
        router.push(`/tasks?project_id=${encodeURIComponent(projectId)}&create=1`);
      }
      onNavigate?.();
      return;
    }

    router.push(target);
    onNavigate?.();
  }

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'accent-scrollbar z-[170] flex h-dvh w-80 flex-col overflow-y-auto border-r border-dashboard-border bg-[#03101a]/95 px-6 py-5 text-dashboard-text shadow-panel backdrop-blur-xl lg:sticky lg:top-0',
        className,
      )}
    >
      <div className="mb-8 flex items-center gap-3">
        <BrandMark />
        <span className="font-poppins text-[28px] mt-2 font-medium leading-none tracking-normal">
          Chrono
        </span>
      </div>

      <div className="group relative mb-10">
        <div className="flex h-14 overflow-hidden rounded-xl border border-dashboard-accent/60 bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong text-white transition hover:brightness-110">
          <button
            className="flex flex-1 items-center justify-center gap-3 px-6 text-base font-normal"
            onClick={() => openCreateTaskModal(activeProjectId)}
            type="button"
          >
            <PlusIcon className="h-6 w-6 mb-1" />
            <span>Add Task</span>
          </button>

          <button
            aria-label="Open add task menu"
            className="grid w-[64px] place-items-center border-l border-white/30 transition hover:bg-white/10"
            type="button"
          >
            <ChevronDownIcon className="h-6 w-6 transition-transform duration-200 group-hover:rotate-180" />
          </button>
        </div>

        <div
          className="
            invisible absolute left-0 right-0 top-full z-50 mt-2
            translate-y-1 rounded-xl border border-dashboard-border
            bg-[#071923] p-2 opacity-0 shadow-panel
            transition-all duration-200
            group-hover:visible group-hover:translate-y-0 group-hover:opacity-100
          "
        >
          <button
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
            onClick={() => openCreateTaskModal(null)}
            type="button"
          >
            <TasksIcon className="h-5 w-5" />
            Create task
          </button>

          <button
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
            onClick={() => {
              if (activeProjectId) {
                openCreateTaskModal(activeProjectId);
                return;
              }
              router.push('/folders');
              onNavigate?.();
            }}
            type="button"
          >
            <FolderIcon className="h-5 w-5" />
            Create task in folder
          </button>
        </div>
      </div>

      <nav aria-label="Main navigation" className="space-y-8">
        <section>
          <SectionTitle>General</SectionTitle>
          <div className="space-y-1.5">
            {generalNavItems.map((item) => {
              const navItem =
                item.href === '/tasks' && allTasksCount !== null
                  ? { ...item, badge: String(allTasksCount) }
                  : item;
              const active =
                item.href === '/tasks'
                  ? isActive(pathname, item) && !activeProjectId
                  : isActive(pathname, item);

              return (
                <NavLink active={active} item={navItem} key={item.href} onNavigate={onNavigate} />
              );
            })}
          </div>
        </section>

        <section className="border-t border-[#AAAAAA]/20 pt-6">
          <SectionTitle actionLabel="Add folder" onAction={openCreateFolderModal}>
            Projects / Folders
          </SectionTitle>
          <div className="space-y-1.5">
            <NavLink active={foldersActive} item={foldersNavItem} onNavigate={onNavigate} />
            <div
              className="accent-scrollbar max-h-[232px] overflow-y-auto pt-1"
              ref={folderListRef}
            >
              {folders.map((folder) => (
                <Link
                  aria-current={activeProjectId === folder.id ? 'page' : undefined}
                  className={cn(
                    'group flex h-11 items-center gap-4 rounded-lg px-3 text-[15px] font-normal transition',
                    activeProjectId === folder.id
                      ? 'border-l-4 border-l-dashboard-accent bg-dashboard-accent/20 text-dashboard-accent'
                      : 'text-dashboard-muted hover:bg-dashboard-surface hover:text-dashboard-text',
                  )}
                  href={`/tasks?project_id=${encodeURIComponent(folder.id)}`}
                  key={folder.id}
                  onClick={onNavigate}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-sm font-medium leading-none',
                      activeProjectId === folder.id
                        ? 'bg-dashboard-bg/25 text-dashboard-text'
                        : 'bg-dashboard-accent-soft text-dashboard-accent',
                    )}
                  >
                    {folder.task_count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </nav>

      <div className="mt-auto pt-8">
        <div
          className="mb-6 overflow-hidden rounded-2xl border border-dashboard-border p-6 aspect-[4.2/3]"
          style={{
            backgroundImage: "url('/sidebar.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <p className="text-base font-semibold text-dashboard-text">Keep going!🚀</p>

          <p className="mt-1 pr-10 text-sm leading-5 text-dashboard-muted">
            Small progress every day leads to big results.
          </p>
        </div>

        <Link
          aria-current={settingsActive ? 'page' : undefined}
          className={cn(
            'flex h-12 items-center gap-4 rounded-lg border-t border-dashboard-border px-2 pt-4 text-[15px] font-medium transition',
            settingsActive
              ? 'text-dashboard-accent'
              : 'text-dashboard-muted hover:text-dashboard-text',
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
