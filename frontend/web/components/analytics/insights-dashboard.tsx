'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CircleCheck,
  CircleQuestionMark,
  Flame,
  Hourglass,
  ListTodo,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { PageHeadingActions } from '../layout/page-heading';

import {
  getInsightsSummary,
  getWeeklyInsight,
  type WeeklyInsight,
  type InsightsSummary,
} from '../../lib/analytics';
import {
  onFocusDataChanged,
  onSettingsDataChanged,
  onTaskDataChanged,
} from '../../lib/data-events';

function formatWeeklySummary(summary: InsightsSummary) {
  const change = summary.week_over_week_change_percent;
  const completedTaskCount = summary.tasks_completed_this_week;
  const taskLabel = completedTaskCount === 1 ? 'task' : 'tasks';

  if (summary.tasks_completed_this_week === 0) {
    return summary.weekly_summary_text;
  }

  if (change === null) {
    return (
      <>
        You&apos;ve completed{' '}
        <strong>
          {completedTaskCount} {taskLabel}
        </strong>{' '}
        this week — great start compared with last week!
      </>
    );
  }

  const absolute = Math.abs(change);
  const direction = change >= 0 ? 'more' : 'fewer';

  return (
    <>
      You&apos;ve completed{' '}
      <strong>
        {completedTaskCount} {taskLabel}
      </strong>{' '}
      this week, that&apos;s <span className="font-semibold text-[var(--accent)]">{absolute}%</span>{' '}
      {direction} than last week!
    </>
  );
}

function TrendChart({
  points,
  gradientId = 'insightsTrendFill',
}: {
  points: Array<{ completed_count: number; date?: string }>;
  gradientId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const max = Math.max(1, ...points.map((point) => point.completed_count));
  const height = 170;
  const horizontalPadding = 28;
  const chartTop = 12;
  const chartBottom = 136;
  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = (nextWidth: number) => {
      if (nextWidth > 0) setWidth(Math.round(nextWidth));
    };
    updateWidth(container.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const coordinates = points.map((point, index) => {
    const x =
      horizontalPadding +
      (index / Math.max(points.length - 1, 1)) * (width - horizontalPadding * 2);
    const y = chartBottom - (point.completed_count / max) * (chartBottom - chartTop);
    const date = point.date ? new Date(`${point.date}T00:00:00Z`) : null;
    return {
      x,
      y,
      count: point.completed_count,
      label:
        date && !Number.isNaN(date.getTime()) ? weekdayLabels[date.getUTCDay()] : String(index + 1),
    };
  });

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const area = `${path} L ${coordinates.at(-1)?.x ?? width} ${chartBottom} L ${
    coordinates[0]?.x ?? horizontalPadding
  } ${chartBottom} Z`;

  const last = coordinates.at(-1);

  return (
    <div className="w-full" ref={containerRef}>
      <svg aria-hidden className="h-[170px] w-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(53, 227, 181, 0.35)" />
            <stop offset="100%" stopColor="rgba(53, 227, 181, 0)" />
          </linearGradient>
        </defs>
        {coordinates.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <line
              stroke="var(--border-subtle)"
              strokeDasharray="4 6"
              strokeWidth="1"
              x1={point.x}
              x2={point.x}
              y1={chartTop}
              y2={chartBottom}
            />
            <text fill="var(--text-muted)" fontSize="13" textAnchor="middle" x={point.x} y="162">
              {point.label}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {coordinates.map((point, index) => (
          <circle cx={point.x} cy={point.y} fill="var(--accent)" key={`point-${index}`} r="3.5" />
        ))}
        {last ? (
          <>
            <circle cx={last.x} cy={last.y} fill="var(--accent)" r="5" />
            <text
              fill="var(--accent)"
              fontSize="16"
              textAnchor="middle"
              x={last.x}
              y={Math.max(20, last.y - 12)}
            >
              ★
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}

export function InsightsDashboard() {
  const [selectedWeek, setSelectedWeek] = useState<'this-week' | 'last-week'>('this-week');
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyInsight | null>(null);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function load(signal?: AbortSignal) {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getInsightsSummary(signal);
      setSummary(data);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(requestError instanceof Error ? requestError.message : 'Could not load insights.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    void getWeeklyInsight(controller.signal)
      .then((insight) => {
        if (!controller.signal.aborted) setWeekly(insight);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setWeeklyError(
            requestError instanceof Error ? requestError.message : 'Could not load weekly insight.',
          );
      });
    const unsubscribeTasks = onTaskDataChanged(() => {
      void load();
    });
    const unsubscribeSettings = onSettingsDataChanged(() => {
      void load();
    });
    const unsubscribeFocus = onFocusDataChanged(() => {
      void load();
    });

    return () => {
      controller.abort();
      unsubscribeTasks();
      unsubscribeSettings();
      unsubscribeFocus();
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeadingActions>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="sr-only" id="review-week-label">
            Review week
          </span>
          <div
            aria-labelledby="review-week-label"
            className="inline-flex rounded-xl border border-dashboard-border bg-dashboard-surface p-1"
            role="group"
          >
            {(['this-week', 'last-week'] as const).map((week) => (
              <button
                aria-pressed={selectedWeek === week}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent ${
                  selectedWeek === week
                    ? 'bg-dashboard-accent-soft text-dashboard-accent'
                    : 'text-dashboard-muted hover:bg-[var(--bg-surface-raised)] hover:text-dashboard-text'
                }`}
                key={week}
                onClick={() => setSelectedWeek(week)}
                type="button"
              >
                {week === 'this-week' ? 'This week' : 'Last week'}
              </button>
            ))}
          </div>
        </div>
      </PageHeadingActions>

      {selectedWeek === 'last-week' ? (
        <WeeklyInsightCard insight={weekly} error={weeklyError} />
      ) : summary ? (
        <CurrentWeekReview summary={summary} />
      ) : error ? (
        <p className="text-sm text-[var(--red-light)]" role="alert">
          {error}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-dashboard-muted" role="status">
          Loading current activity…
        </p>
      ) : null}
    </div>
  );
}

function CurrentWeekReview({ summary }: { summary: InsightsSummary }) {
  const currentWeekDateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: summary.timezone,
  });
  const currentWeekStart = currentWeekDateFormat.format(new Date(summary.period_start));
  const currentWeekEnd = currentWeekDateFormat.format(
    new Date(new Date(summary.period_end).getTime() - 1),
  );

  return (
    <div className="space-y-6">
      <section
        aria-label="This week's review"
        className="overflow-hidden rounded-[20px] border border-dashboard-border bg-dashboard-surface shadow-panel"
      >
        <header className="border-b border-dashboard-border px-6 py-5 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-medium text-dashboard-muted">
            <span aria-hidden className="text-dashboard-accent">
              ◷
            </span>
            {currentWeekStart} - {currentWeekEnd} · {summary.timezone}
          </p>
        </header>

        <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
          <section aria-label="Weekly summary">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="relative isolate flex flex-col items-start justify-center gap-5 overflow-hidden rounded-[16px] border border-dashboard-accent/25 bg-dashboard-bg/40 p-6">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 size-full text-dashboard-accent"
                  focusable="false"
                  preserveAspectRatio="none"
                  viewBox="0 0 480 360"
                >
                  <path
                    d="M55 360 180 310 235 276 255 276 300 242 320 252 331 252 370 218 380 216 410 190 432 209 444 213 480 240V360Z"
                    fill="currentColor"
                    opacity="0.08"
                  />
                  <path
                    d="M125 360 236 319 281 301 305 310 347 287 358 289 395 267 480 302V360Z"
                    fill="currentColor"
                    opacity="0.05"
                  />
                </svg>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-dashboard-accent-soft text-dashboard-accent">
                  {summary.tasks_completed_this_week === 0 ? (
                    <CircleQuestionMark aria-hidden="true" className="size-7" strokeWidth={1.75} />
                  ) : (
                    <ListTodo aria-hidden="true" className="size-6" strokeWidth={1.75} />
                  )}
                </span>
                <p className="text-base leading-7 text-dashboard-text sm:text-lg sm:leading-8">
                  {formatWeeklySummary(summary)}
                </p>
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-dashboard-accent px-4 py-2 text-sm font-semibold text-dashboard-on-accent transition hover:bg-dashboard-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dashboard-accent"
                  href="/tasks"
                >
                  View tasks
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
              <div className="rounded-[16px] border border-dashboard-border bg-[var(--bg-surface-raised)] px-4 pb-3 pt-4">
                <TrendChart points={summary.trend} />
                <p className="border-t border-dashboard-border px-3 pt-3 text-center text-sm italic text-dashboard-subtle">
                  {summary.motivational_quote}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Key metrics">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                icon={Trophy}
                iconClass="bg-[var(--accent-soft)] text-[var(--accent)]"
                label="Completion Rate"
                value={`${Math.round((summary.completion_rate_this_week ?? 0) * 100)}%`}
              />
              <StatCard
                icon={CircleCheck}
                iconClass="bg-[var(--accent-soft)] text-[var(--accent)]"
                label="Completed Tasks"
                value={String(summary.tasks_completed_this_week)}
              />
              <StatCard
                icon={Timer}
                iconClass="bg-[var(--blue-soft)] text-[var(--blue-light)]"
                label="Focus Duration"
                value={`${summary.focus_duration_minutes_this_week ?? 0} min`}
              />
              <StatCard
                icon={Hourglass}
                iconClass="bg-[var(--purple-soft)] text-[var(--purple-light)]"
                label="Unfinished Workload"
                value={`${summary.unfinished_workload_minutes_this_week ?? 0} min`}
              />
              <StatCard
                icon={Flame}
                iconClass="bg-[var(--orange-soft)] text-[var(--orange)]"
                label="Streak"
                value={`${summary.current_streak_days} days`}
              />
            </div>
          </section>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[18px] border border-dashboard-border bg-dashboard-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            ♥
          </div>
          <p className="max-w-3xl text-base leading-7 text-dashboard-muted">
            {summary.footer_message}
          </p>
        </div>
      </section>
    </div>
  );
}

function MetricIcon({ icon: Icon, iconClass }: { icon: LucideIcon; iconClass: string }) {
  return (
    <span className={`mb-3 grid size-10 place-items-center rounded-xl ${iconClass}`}>
      <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </span>
  );
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-[108px] rounded-[14px] border border-dashboard-border bg-[var(--bg-surface-raised)] p-4">
      <MetricIcon icon={icon} iconClass={iconClass} />
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-dashboard-muted">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-dashboard-text">{value}</p>
    </div>
  );
}

function WeeklyInsightCard({
  insight,
  error,
}: {
  insight: WeeklyInsight | null;
  error: string | null;
}) {
  if (!insight)
    return (
      <section
        aria-live="polite"
        className="rounded-[20px] border border-dashboard-border bg-dashboard-surface p-6"
      >
        <p className="text-dashboard-muted">{error || 'Loading last week’s review…'}</p>
      </section>
    );
  const metrics = insight.metrics;
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: metrics.timezone,
  });
  const start = dateFormat.format(new Date(insight.period_start));
  const end = dateFormat.format(new Date(new Date(insight.period_end).getTime() - 1));
  const stats = [
    {
      label: 'Completion rate',
      value: `${Math.round(metrics.completion_rate * 100)}%`,
      icon: Trophy,
      iconClass: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    },
    {
      label: 'Completed tasks',
      value: String(metrics.completed_task_count),
      icon: CircleCheck,
      iconClass: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    },
    {
      label: 'Focus duration',
      value: `${metrics.focus_duration_minutes} min`,
      icon: Timer,
      iconClass: 'bg-[var(--blue-soft)] text-[var(--blue-light)]',
    },
    {
      label: 'Unfinished workload',
      value: `${metrics.workload_minutes} min`,
      icon: Hourglass,
      iconClass: 'bg-[var(--purple-soft)] text-[var(--purple-light)]',
    },
    {
      label: 'Streak',
      value: `${metrics.current_streak_days} days`,
      icon: Flame,
      iconClass: 'bg-[var(--orange-soft)] text-[var(--orange)]',
    },
  ];
  return (
    <section
      aria-label="Last week's review"
      className="overflow-hidden rounded-[20px] border border-dashboard-border bg-dashboard-surface shadow-panel"
    >
      <header className="border-b border-dashboard-border px-6 py-5 sm:px-8">
        <p className="flex items-center gap-2 text-sm font-medium text-dashboard-muted">
          <span aria-hidden className="text-dashboard-accent">
            ◷
          </span>
          {start} - {end} · {metrics.timezone}
        </p>
      </header>

      <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
        {metrics.completed_task_count > 0 || metrics.focus_duration_minutes > 0 ? (
          <section aria-label="Weekly summary">
            <div className="rounded-[16px] border border-dashboard-accent/30 bg-dashboard-accent-soft/40 px-5 py-4">
              <p className="text-base leading-7 text-dashboard-text sm:text-lg sm:leading-8">
                {insight.narrative}
              </p>
            </div>
          </section>
        ) : null}

        <section aria-label="Key metrics">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map(({ label, value, icon, iconClass }) => (
              <div
                className="rounded-[14px] border border-dashboard-border bg-[var(--bg-surface-raised)] px-4 py-4"
                key={label}
              >
                <MetricIcon icon={icon} iconClass={iconClass} />
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-dashboard-muted">
                  {label}
                </dt>
                <dd className="mt-2 text-xl font-semibold text-dashboard-text">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Activity patterns">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[16px] border border-dashboard-border bg-[var(--bg-surface-raised)] p-5">
              <h3 className="font-semibold text-dashboard-text">Daily productivity</h3>
              <p className="mt-1 text-sm text-dashboard-muted">Completed tasks and focused time</p>
              <div className="mt-4 rounded-[14px] border border-dashboard-border bg-dashboard-surface px-3 py-3">
                <TrendChart
                  gradientId="previousWeekTrendFill"
                  points={metrics.productivity_trend}
                />
                <p className="mt-1 text-center text-xs text-dashboard-subtle">
                  Completed-task trend across the week
                </p>
              </div>
              <ul className="mt-4 divide-y divide-dashboard-border text-sm">
                {metrics.productivity_trend.map((point) => (
                  <li className="flex items-center justify-between gap-4 py-2.5" key={point.date}>
                    <span className="text-dashboard-muted">{point.date}</span>
                    <span className="text-right font-medium text-dashboard-text">
                      {point.completed_count} tasks · {point.focus_minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[16px] border border-dashboard-border bg-[var(--bg-surface-raised)] p-5">
              <h3 className="font-semibold text-dashboard-text">Productive hours</h3>
              <p className="mt-1 text-sm text-dashboard-muted">
                Activity by hour · {metrics.timezone}
              </p>
              <ul className="mt-4 divide-y divide-dashboard-border text-sm">
                {metrics.productive_hours.map((point) => (
                  <li className="flex items-center justify-between gap-4 py-2.5" key={point.hour}>
                    <span className="text-dashboard-muted">
                      {String(point.hour).padStart(2, '0')}:00
                    </span>
                    <span className="text-right font-medium text-dashboard-text">
                      {point.completed_count} tasks · {point.focus_minutes} min
                    </span>
                  </li>
                ))}
              </ul>
              {!metrics.productive_hours.length && (
                <p className="mt-4 rounded-[12px] border border-dashed border-dashboard-border px-4 py-5 text-center text-sm text-dashboard-muted">
                  No recorded activity.
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-dashboard-subtle">
            {metrics.focus_time_attribution} Minutes are rounded down after aggregation within each
            bucket.
          </p>
        </section>

        <p className="border-t border-dashboard-border pt-4 text-xs text-dashboard-subtle">
          Saved {dateFormat.format(new Date(insight.generated_at))}. This report reuses its saved
          metrics throughout the week.
        </p>
      </div>
    </section>
  );
}
