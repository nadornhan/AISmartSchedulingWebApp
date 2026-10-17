'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { getGamificationProfile, onGrowthReward } from '../../lib/gamification';
import { CurrentUserProvider, useCurrentUser } from '../auth/current-user-provider';
import { GrowthRewardToast } from '../gamification/growth-reward-toast';
import { Header, HeaderActions, SearchBox } from './header';
import { MobileBottomNavigation } from './mobile-bottom-navigation';
import { MobileTopHeader } from './mobile-top-header';
import { Sidebar } from './sidebar';
import { DashboardHeadingProvider } from './dashboard-heading-context';
import { PageHeading } from './page-heading';
import { PageEntrance } from './page-entrance';

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
  const { error, refreshUser, sessionStatus, user } = useCurrentUser();
  const userId = user?.id;
  const [xp, setXp] = useState<{ userId: string; total: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const profileUserId = userId;
    const controller = new AbortController();
    let revision = 0;

    async function loadXp() {
      const requestRevision = ++revision;
      try {
        const profile = await getGamificationProfile({ signal: controller.signal });
        if (!controller.signal.aborted && requestRevision === revision) {
          setXp({ userId: profileUserId, total: profile.total_growth_points });
        }
      } catch {
        // Keep the last known total when the profile is temporarily unavailable.
      }
    }

    const unsubscribe = onGrowthReward((reward) => {
      if (controller.signal.aborted) return;
      if (reward.profile) {
        revision += 1;
        setXp({ userId, total: reward.profile.total_growth_points });
      } else {
        void loadXp();
      }
    });
    void loadXp();

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [userId]);

  const totalXp = xp?.userId === userId ? xp?.total : null;

  return (
    <DashboardHeadingProvider>
      <div className="min-h-dvh bg-dashboard-bg text-dashboard-text lg:flex">
        <Suspense fallback={null}>
          <Sidebar className="hidden lg:flex" />
        </Suspense>

        <div className="min-w-0 flex-1">
          <MobileTopHeader title={meta.title} />
          <Header totalXp={totalXp} user={user} />
          <main
            className={`min-h-[calc(100dvh-7rem)] px-6 pb-32 ${pathname === '/' ? 'pt-[max(1.25rem,env(safe-area-inset-top))]' : 'pt-5'} lg:min-h-[calc(100dvh-6rem)] lg:px-10 lg:pb-8 lg:pt-5 xl:px-12`}
          >
            {pathname !== '/gamification' ? (
              <PageHeading
                mobileTitleInHeader={pathname !== '/'}
                mobileSearch={pathname === '/' ? <SearchBox compact /> : undefined}
                mobileActions={
                  pathname === '/' ? <HeaderActions compact showXp={false} /> : undefined
                }
                title={meta.title}
                subtitle={meta.subtitle}
              />
            ) : null}
            {sessionStatus === 'checking' ? (
              <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
                Checking your session...
              </div>
            ) : sessionStatus === 'unavailable' ? (
              <div
                className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted"
                role="alert"
              >
                <p>{error ?? 'Unable to check your session. Please try again.'}</p>
                <button
                  className="mt-4 rounded-lg border border-dashboard-border px-4 py-2 text-sm font-medium text-dashboard-text transition hover:border-dashboard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent"
                  onClick={() => void refreshUser()}
                  type="button"
                >
                  Try again
                </button>
              </div>
            ) : sessionStatus === 'authenticated' ? (
              <PageEntrance>{children}</PageEntrance>
            ) : (
              <div className="rounded-lg border border-dashboard-border bg-dashboard-surface p-6 text-dashboard-muted">
                Redirecting to sign in...
              </div>
            )}
          </main>
          <GrowthRewardToast />
          <MobileBottomNavigation />
        </div>
      </div>
    </DashboardHeadingProvider>
  );
}
