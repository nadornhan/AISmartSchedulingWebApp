'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentUser } from '../auth/current-user-provider';
import { onSettingsDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { getDashboardSummary, type DashboardSummary } from '../../lib/dashboard';
import { formatDurationLabel } from '../../lib/duration';
import { updateTask } from '../../lib/tasks';
import { CalendarIcon, CheckIcon, FlameIcon, FocusIcon } from '../layout/icons';
import { DashboardEmptyState } from './dashboard-empty-state';
import { DashboardErrorState } from './dashboard-error-state';
import { DashboardLoadingState } from './dashboard-loading-state';
import { DashboardStatCard } from './dashboard-stat-card';
import { ForestWidget } from '../gamification/forest-widget';
import { PlantVisual } from '../gamification/plant-visual';
import { InProgressList } from './in-progress-list';
import { AiRecommendationCard } from './ai-recommendation-card';
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

function todayLabel() {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
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

  useEffect(
    () =>
      onSettingsDataChanged(() => {
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
  const remainingToday = Math.max(
    0,
    summary.today_progress.total - summary.today_progress.completed,
  );
  const dailyMessage =
    remainingToday === 0 && summary.today_progress.total > 0
      ? 'Everything planned for today is complete.'
      : remainingToday > 0
        ? `${remainingToday} task${remainingToday === 1 ? '' : 's'} left in today’s plan.`
        : 'Add a task or plan your day when you are ready.';

  const hasDashboardTasks =
    summary.task_progress.total > 0 ||
    summary.ai_recommendation !== null ||
    summary.quick_wins.length > 0 ||
    summary.in_progress.length > 0;

  return (
    <div className="mx-auto max-w-[1480px] space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-dashboard-accent">{todayLabel()}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-dashboard-text sm:text-4xl">
            {greeting}
          </h1>
          <p className="mt-2 text-sm text-dashboard-muted sm:text-base">{dailyMessage}</p>
          <PlantVisual
            className="pointer-events-none -ml-7 mt-3 drop-shadow-[0_10px_18px_rgba(26,190,139,.2)] lg:hidden"
            size={88}
            speciesKey={summary.forest?.species_name?.toLowerCase().replace(/\s+/g, '_')}
            stage={summary.forest?.growth_stage || 'seedling'}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 px-4 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text"
            href="/calendar"
          >
            Open calendar
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-sm)] bg-dashboard-accent px-4 text-sm font-semibold text-[#04110d] transition hover:bg-dashboard-accent-strong"
            href="/tasks"
          >
            View all tasks
          </Link>
        </div>
      </section>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-accent">
            Start here
          </p>
          <h2 className="mt-1 text-xl font-semibold text-dashboard-text">Your next move</h2>
        </div>
        {summary.ai_recommendation ? (
          <AiRecommendationCard
            item={summary.ai_recommendation}
            onChanged={() => void loadSummary()}
          />
        ) : (
          <NextBestTaskCard item={summary.next_best_task} />
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-muted">
              Today
            </p>
            <h2 className="mt-1 text-xl font-semibold text-dashboard-text">Keep things moving</h2>
          </div>
          <Link className="text-sm font-semibold text-dashboard-accent hover:underline" href="/tasks">
            View all
          </Link>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <InProgressList tasks={summary.in_progress} />
          <QuickWinsCard
            completingTaskId={completingTaskId}
            onComplete={completeQuickWin}
            tasks={summary.quick_wins}
          />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-muted">
            Progress
          </p>
          <h2 className="mt-1 text-xl font-semibold text-dashboard-text">This week</h2>
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <WeeklyActivityCard points={summary.weekly_activity} />
          <ForestWidget forest={summary.forest} />
        </div>
      </section>
    </div>
  );
}
