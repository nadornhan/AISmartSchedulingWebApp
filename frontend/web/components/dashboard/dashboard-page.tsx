'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentUser } from '../auth/current-user-provider';
import { onTaskDataChanged } from '../../lib/data-events';
import { getDashboardSummary, type DashboardSummary } from '../../lib/dashboard';
import { DashboardEmptyState } from './dashboard-empty-state';
import { DashboardErrorState } from './dashboard-error-state';
import { DashboardLoadingState } from './dashboard-loading-state';
import { DashboardStatCard } from './dashboard-stat-card';
import { FocusSessionLauncher } from './focus-session-launcher';
import { InProgressList } from './in-progress-list';
import { NextBestTaskCard } from './next-best-task-card';
import { QuickWinsCard } from './quick-wins-card';
import { WeeklyActivityCard } from './weekly-activity-card';

function greetingForNow(name: string) {
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${dayPart}, ${name}`;
}

function displayName(firstName?: string, lastName?: string) {
  const fullName = [firstName, lastName].map((part) => part?.trim()).filter(Boolean).join(' ');
  return fullName || 'there';
}

export function DashboardPage() {
  const { user } = useCurrentUser();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getDashboardSummary(signal);
      setSummary(data);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to load dashboard.',
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSummary(controller.signal);
    return () => controller.abort();
  }, [loadSummary]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void loadSummary();
      }),
    [loadSummary],
  );

  const greeting = useMemo(
    () => greetingForNow(displayName(user?.first_name, user?.last_name)),
    [user?.first_name, user?.last_name],
  );

  if (isLoading && !summary) {
    return <DashboardLoadingState />;
  }

  if (error && !summary) {
    return <DashboardErrorState message={error} onRetry={() => void loadSummary()} />;
  }

  if (!summary) return null;

  const hasDashboardTasks =
    summary.task_progress.total > 0 ||
    summary.next_best_task !== null ||
    summary.quick_wins.length > 0 ||
    summary.in_progress.length > 0;

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-dashboard-muted">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-dashboard-text sm:text-4xl">
            {greeting}
          </h1>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardStatCard
          label="Task Progress"
          meta={
            summary.task_progress.percent === null
              ? 'No tasks yet'
              : `${summary.task_progress.completed} of ${summary.task_progress.total} completed`
          }
          value={
            summary.task_progress.percent === null
              ? '—'
              : `${summary.task_progress.percent}%`
          }
        />
        <DashboardStatCard
          accent={summary.overdue_count > 0 ? 'danger' : 'default'}
          label="Overdue"
          meta="Open tasks past their deadline"
          value={String(summary.overdue_count)}
        />
        <DashboardStatCard
          accent="muted"
          label="Today Progress"
          meta="Scheduling data unavailable"
          value="—"
        />
      </section>

      {!hasDashboardTasks ? <DashboardEmptyState /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <NextBestTaskCard item={summary.next_best_task} />
          <FocusSessionLauncher task={summary.next_best_task?.task ?? null} />
          <WeeklyActivityCard points={summary.weekly_activity} />
        </div>
        <div className="space-y-5">
          <QuickWinsCard tasks={summary.quick_wins} />
          <InProgressList tasks={summary.in_progress} />
        </div>
      </section>
    </div>
  );
}
