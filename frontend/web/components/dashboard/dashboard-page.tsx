'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentUser } from '../auth/current-user-provider';
import { onSettingsDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { getDashboardSummary, type DashboardSummary } from '../../lib/dashboard';
import { formatDurationLabel } from '../../lib/duration';
import { updateTask } from '../../lib/tasks';
import { CalendarIcon, CheckIcon, FlameIcon, FocusIcon } from '../layout/icons';
import { DashboardErrorState } from './dashboard-error-state';
import { DashboardLoadingState } from './dashboard-loading-state';
import { DashboardStatCard } from './dashboard-stat-card';
import { ForestWidget } from '../gamification/forest-widget';
import { SuggestedTaskCard } from './suggested-task-card';
import { QuickWinsCard } from './quick-wins-card';
import { WeeklyActivityCard } from './weekly-activity-card';
import { ReschedulingPanel } from '../scheduling/rescheduling-panel';
import { useDashboardHeading } from '../layout/dashboard-heading-context';

function greetingForNow(name: string) {
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${dayPart}, ${name}`;
}

function displayName(firstName?: string, lastName?: string) {
  const fullName = [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
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

function dailyMessageFor(summary: DashboardSummary | null) {
  if (!summary) return 'Add a task or plan your day when you are ready.';
  const remaining = Math.max(0, summary.today_progress.total - summary.today_progress.completed);
  if (remaining === 0 && summary.today_progress.total > 0) {
    return 'Everything planned for today is complete.';
  }
  return remaining > 0
    ? `${remaining} task${remaining === 1 ? '' : 's'} left in today’s plan.`
    : 'Add a task or plan your day when you are ready.';
}

export function DashboardPage() {
  const { user } = useCurrentUser();
  const { setHeading } = useDashboardHeading();
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
      setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard.');
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
          requestError instanceof Error ? requestError.message : 'Unable to complete quick win.',
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

  useEffect(() => {
    setHeading({
      date: todayLabel(),
      greeting,
      message: dailyMessageFor(summary),
    });
    return () => setHeading(null);
  }, [greeting, setHeading, summary]);

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

  return (
    <div className="flex w-full flex-col gap-8">
      <section
        aria-label="Today at a glance"
        data-tour="dashboard-summary"
        className="order-2 grid grid-cols-2 gap-x-[clamp(0.5rem,3vw,1rem)] gap-y-4 sm:gap-x-4 sm:gap-y-5 lg:order-1 xl:grid-cols-4 xl:gap-4"
      >
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
              : 'Complete a task today'
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

      <div className="contents lg:order-2 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-stretch lg:gap-6">
        <div className="order-1 lg:order-none">
          <SuggestedTaskCard
            task={summary.ai_recommendation?.task ?? summary.next_best_task?.task ?? null}
          />
        </div>
        <div className="order-3 lg:order-none">
          <QuickWinsCard
            completingTaskId={completingTaskId}
            onComplete={completeQuickWin}
            tasks={summary.quick_wins}
          />
        </div>
      </div>

      <section className="order-4 lg:order-3">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
          <WeeklyActivityCard points={summary.weekly_activity} />
          <div className="grid min-w-0 gap-5">
            <ReschedulingPanel />
            <ForestWidget forest={summary.forest} />
          </div>
        </div>
      </section>
    </div>
  );
}
