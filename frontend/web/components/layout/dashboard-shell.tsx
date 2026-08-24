'use client';

import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { CurrentUserProvider, useCurrentUser } from '../auth/current-user-provider';
import { GrowthRewardToast } from '../gamification/growth-reward-toast';
import { Header } from './header';
import { MobileBottomNavigation } from './mobile-bottom-navigation';
import { MobileTopHeader } from './mobile-top-header';
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
  '/notifications': {
    title: 'Notifications',
    subtitle: 'Review reminders, deadlines, and schedule updates.',
  },
  '/profile': {
    title: 'Profile',
    subtitle: 'View your account details and manage your profile photo.',
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
    title: 'AI Insights',
    subtitle: 'Personalized productivity insights from your recent activity.',
  },
  '/gamification': {
    title: 'Personal Forest',
    subtitle: 'Watch your forest grow with every effort',
  },
  '/gamification/forest': {
    title: 'Your Forest',
    subtitle: 'Wander your garden and place mature trees.',
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
        <Sidebar className="hidden lg:flex" />
      </Suspense>

      <div className="min-w-0 flex-1">
        <MobileTopHeader title={meta.title} user={user} />
        <Header subtitle={meta.subtitle} title={meta.title} user={user} />
        <main className="min-h-[calc(100dvh-7rem)] px-6 pb-32 pt-7 lg:px-10 lg:py-8 xl:px-12">
          {isCheckingSession && !user ? (
            <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
              Checking your session...
            </div>
          ) : (
            children
          )}
        </main>
        <GrowthRewardToast />
        <MobileBottomNavigation />
      </div>
    </div>
  );
}
