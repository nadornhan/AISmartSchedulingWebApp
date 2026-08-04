'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentUser } from '../auth/current-user-provider';
import { onTaskDataChanged } from '../../lib/data-events';
import { getDashboardSummary, type DashboardSummary } from '../../lib/dashboard';
import { formatDurationLabel } from '../../lib/duration';
import { updateTask } from '../../lib/tasks';
import { CalendarIcon, CheckIcon, FlameIcon, FocusIcon } from '../layout/icons';
import { DashboardEmptyState } from './dashboard-empty-state';
import { DashboardErrorState } from './dashboard-error-state';
import { DashboardLoadingState } from './dashboard-loading-state';
import { DashboardStatCard } from './dashboard-stat-card';
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

function formatFocusMinutes(minutes: number) {
  return minutes > 0 ? formatDurationLabel(minutes) : '0 min';
}

export function DashboardPage() {
  const { user } = useCurrentUser();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
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

  const completeQuickWin = useCallback(
    async (taskId: string) => {
      setCompletingTaskId(taskId);
      try {
        await updateTask(taskId, { status: 'done' });
        await loadSummary();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to complete quick win.',
        );
      } finally {
        setCompletingTaskId(null);
      }
    },
    [loadSummary],
  );

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

  const todayPercent = summary.today_progress.percent;
  const focusGoal = summary.focus_goal;
  const focusValue = formatFocusMinutes(focusGoal.completed_minutes);
  const focusMeta = `of ${formatFocusMinutes(focusGoal.goal_minutes)} daily goal`;

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          icon={<CheckIcon className="h-5 w-5" />}
          label="Today Progress"
          meta={
            todayPercent === null
              ? 'No tasks for today'
              : `${summary.today_progress.completed} of ${summary.today_progress.total} tasks completed`
          }
          value={todayPercent === null ? '-' : `${todayPercent}%`}
          progress={todayPercent}
        />
        <DashboardStatCard
          accent="info"
          icon={<FocusIcon className="h-5 w-5" />}
          label="Focus Goal"
          meta={focusMeta}
          progress={focusGoal.percent}
          value={focusValue}
        />
        <DashboardStatCard
          accent="warning"
          icon={<FlameIcon className="h-5 w-5" />}
          label="Current Streak"
          meta={
            summary.current_streak_days > 0
              ? 'Keep it up!'
              : 'Complete a task today to start a streak'
          }
          progress={summary.current_streak_days > 0 ? 100 : 0}
          value={`${summary.current_streak_days} days`}
        />
        <DashboardStatCard
          accent={summary.overdue_count > 0 ? 'danger' : 'default'}
          icon={<CalendarIcon className="h-5 w-5" />}
          label="Overdue Tasks"
          meta="Need your attention"
          progress={summary.overdue_count > 0 ? 100 : 0}
          value={String(summary.overdue_count)}
        />
      </section>

      {!hasDashboardTasks ? <DashboardEmptyState /> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <NextBestTaskCard item={summary.next_best_task} />
          <WeeklyActivityCard points={summary.weekly_activity} />
        </div>
        <div className="space-y-5">
          <QuickWinsCard
            completingTaskId={completingTaskId}
            onComplete={completeQuickWin}
            tasks={summary.quick_wins}
          />
          <InProgressList tasks={summary.in_progress} />
        </div>
      </section>
    </div>
  );
}
