'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { clearSession, getCachedCurrentUser, getCurrentUser } from '../../lib/auth';
import type { UserResponse } from '../../lib/auth';
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
  const pathname = usePathname();
  const router = useRouter();
  const meta = getRouteMeta(pathname);
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true') {
      setCurrentUser({
        id: 'local-test-user',
        email: 'tester@localhost',
        first_name: 'Local',
        last_name: 'Tester',
        role: 'student',
      });
      setIsCheckingSession(false);
      return;
    }

    let isMounted = true;
    const cachedUser = getCachedCurrentUser();

    if (cachedUser) {
      setCurrentUser(cachedUser);
    }

    getCurrentUser()
      .then((user) => {
        if (isMounted) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        clearSession();
        router.replace('/login');
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-dvh bg-dashboard-bg text-dashboard-text lg:flex">
      <Sidebar className="max-lg:h-auto max-lg:w-full max-lg:border-b max-lg:border-r-0 max-lg:px-4 max-lg:py-5" />

      <div className="min-w-0 flex-1">
        <Header subtitle={meta.subtitle} title={meta.title} user={currentUser} />
        <main className="min-h-[calc(100dvh-7rem)] px-6 py-8 lg:px-10 xl:px-12">
          {isCheckingSession && !currentUser ? (
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
