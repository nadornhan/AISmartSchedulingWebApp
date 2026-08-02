'use client';

import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { CurrentUserProvider, useCurrentUser } from '../auth/current-user-provider';
import { Header } from './header';
import { Sidebar } from './sidebar';

type DashboardShellProps = {
  children: ReactNode;
};

type RouteMeta = {
  title: string;
  subtitle: string;
};

const routeMeta: Record<string, RouteMeta> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Track your tasks, focus time, and progress at a glance.',
  },
  '/tasks': {
    title: 'All Tasks',
    subtitle: 'Review, prioritize, and complete your scheduled tasks.',
  },
  '/folders': {
    title: 'Folders',
    subtitle: 'Organize your tasks into projects.',
  },
  '/calendar': {
    title: 'Calendar',
    subtitle: 'Plan deadlines, reminders, and time blocks.',
  },
  '/priority': {
    title: 'Priority View',
    subtitle: 'Focus on what matters most.',
  },
  '/focus': {
    title: 'Focus Mode',
    subtitle: 'Stay focused. Beat distraction. Get things done.',
  },
  '/analytics': {
    title: 'Insights',
    subtitle: 'Understand productivity patterns and scheduling trends.',
  },
  '/gamification': {
    title: 'Gamification',
    subtitle: 'Keep streaks, milestones, and rewards visible.',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Tune your account, scheduling, and notification preferences.',
  },
};

function getRouteMeta(pathname: string): RouteMeta {
  const exactMatch = routeMeta[pathname];

  if (exactMatch) {
    return exactMatch;
  }

  const parentPath = Object.keys(routeMeta)
    .filter((route) => route !== '/' && pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];

  return parentPath ? routeMeta[parentPath] : routeMeta['/'];
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <CurrentUserProvider>
      <DashboardShellContent>{children}</DashboardShellContent>
    </CurrentUserProvider>
  );
}

function DashboardShellContent({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const meta = getRouteMeta(pathname);
  const { isCheckingSession, user } = useCurrentUser();

  return (
    <div className="min-h-dvh bg-dashboard-bg text-dashboard-text lg:flex">
      <Suspense fallback={null}>
        <Sidebar className="max-lg:h-auto max-lg:w-full max-lg:border-b max-lg:border-r-0 max-lg:px-4 max-lg:py-5" />
      </Suspense>

      <div className="min-w-0 flex-1">
        <Header subtitle={meta.subtitle} title={meta.title} user={user} />
        <main className="relative z-0 min-h-[calc(100dvh-7rem)] px-6 py-8 lg:px-10 xl:px-12">
          {isCheckingSession && !user ? (
            <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
              Checking your session...
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
