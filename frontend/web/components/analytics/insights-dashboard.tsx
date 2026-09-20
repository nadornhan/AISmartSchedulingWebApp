'use client';

import { useEffect, useRef, useState } from 'react';

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
  if (summary.tasks_completed_this_week === 0) {
    return summary.weekly_summary_text;
  }

  if (change === null) {
    return (
      <>
        You&apos;ve completed <strong>{summary.tasks_completed_this_week} tasks</strong> this week —
        great start compared with last week!
      </>
    );
  }

  const absolute = Math.abs(change);
  const direction = change >= 0 ? 'more' : 'fewer';

  return (
    <>
      You&apos;ve completed <strong>{summary.tasks_completed_this_week} tasks</strong> this week,
      that&apos;s <span className="font-semibold text-[var(--accent)]">{absolute}%</span>{' '}
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
              stroke="var(--border)"
              strokeDasharray="4 6"
              strokeWidth="1"
              x1={point.x}
              x2={point.x}
              y1={chartTop}
              y2={chartBottom}
            />
            <text
              fill="var(--text-muted)"
              fontSize="13"
              textAnchor="middle"
              x={point.x}
              y="162"
            >
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
          <circle
            cx={point.x}
            cy={point.y}
            fill="var(--accent)"
            key={`point-${index}`}
            r="3.5"
          />
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

  if (isLoading && !summary) {
    return (
      <div className="space-y-6">
        <WeeklyInsightCard insight={weekly} error={weeklyError} />
        <p className="text-sm text-dashboard-muted">Loading current activity…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        <WeeklyInsightCard insight={weekly} error={weeklyError} />
        <p className="text-sm text-[var(--red-light)]">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

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
      <section className="overflow-hidden rounded-[20px] border border-dashboard-border bg-dashboard-surface shadow-panel">
        <header className="border-b border-dashboard-border px-6 py-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dashboard-accent">
            Current week snapshot
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-dashboard-text">This Week So Far</h2>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-dashboard-muted">
            <span aria-hidden className="text-dashboard-accent">
              ◷
            </span>
            {currentWeekStart} - {currentWeekEnd} · {summary.timezone} · Updates as your activity
            changes
          </p>
        </header>

        <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
          <section aria-labelledby="current-week-progress">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-dashboard-accent-soft text-dashboard-accent">
                🌱
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-accent">
                  Current activity
                </p>
                <h3
                  className="text-lg font-semibold text-dashboard-text"
                  id="current-week-progress"
                >
                  Progress so far
                </h3>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="flex items-center rounded-[16px] border border-dashboard-accent/30 bg-dashboard-accent-soft/40 px-5 py-5">
                <p className="text-base leading-7 text-dashboard-text sm:text-lg sm:leading-8">
                  {formatWeeklySummary(summary)}
                </p>
              </div>
              <div className="rounded-[16px] border border-dashboard-border bg-[var(--bg-surface-raised)] px-4 pb-3 pt-4">
                <TrendChart points={summary.trend} />
                <p className="border-t border-dashboard-border px-3 pt-3 text-center text-sm italic text-dashboard-subtle">
                  {summary.motivational_quote}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="current-week-metrics">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-muted">
                Live measurements
              </p>
              <h3
                className="mt-1 text-lg font-semibold text-dashboard-text"
                id="current-week-metrics"
              >
                Key metrics
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                icon="🏆"
                iconClass="bg-[var(--accent-soft)] text-[var(--accent)]"
                label="Completion Rate"
                value={`${Math.round((summary.completion_rate_this_week ?? 0) * 100)}%`}
              />
              <StatCard
                icon="✓"
                iconClass="bg-[var(--accent-soft)] text-[var(--accent)]"
                label="Completed Tasks"
                value={String(summary.tasks_completed_this_week)}
              />
              <StatCard
                icon="⏱️"
                iconClass="bg-[var(--blue-soft)] text-[var(--blue-light)]"
                label="Focus Duration"
                value={`${summary.focus_duration_minutes_this_week ?? 0} min`}
              />
              <StatCard
                icon="⌛"
                iconClass="bg-[var(--purple-soft)] text-[var(--purple-light)]"
                label="Unfinished Workload"
                value={`${summary.unfinished_workload_minutes_this_week ?? 0} min`}
              />
              <StatCard
                icon="🔥"
                iconClass="bg-[var(--orange-soft)] text-[var(--orange)]"
                label="Streak"
                value={`${summary.current_streak_days} days`}
              />
            </div>
          </section>
        </div>
      </section>

      <WeeklyInsightCard insight={weekly} error={weeklyError} />

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

function StatCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: string;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[108px] items-center rounded-[14px] border border-dashboard-border bg-[var(--bg-surface-raised)] p-4">
      <div className="flex items-center gap-3">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${iconClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-dashboard-muted">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold text-dashboard-text">
            {value}
          </p>
        </div>
      </div>
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
        <h3 className="text-2xl font-semibold text-dashboard-text">Last week’s review</h3>
        <p className="mt-2 text-dashboard-muted">{error || 'Loading last week’s review…'}</p>
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
    ['Completion rate', `${Math.round(metrics.completion_rate * 100)}%`],
    ['Completed tasks', String(metrics.completed_task_count)],
    ['Focus duration', `${metrics.focus_duration_minutes} min`],
    ['Unfinished workload', `${metrics.workload_minutes} min`],
    ['Streak', `${metrics.current_streak_days} days`],
  ];
  return (
    <section className="overflow-hidden rounded-[20px] border border-dashboard-border bg-dashboard-surface shadow-panel">
      <header className="border-b border-dashboard-border px-6 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dashboard-accent">
          Previous week snapshot
        </p>
        <h3 className="mt-1 text-2xl font-semibold text-dashboard-text">Last Week's Review</h3>
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-dashboard-muted">
          <span aria-hidden className="text-dashboard-accent">
            ◷
          </span>
          {start} - {end} · {metrics.timezone}
        </p>
      </header>

      <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
        <section aria-labelledby="weekly-ai-insight">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-dashboard-accent-soft text-dashboard-accent">
              ✦
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-accent">
                Personalized summary
              </p>
              <h4
                className="text-lg font-semibold text-dashboard-text"
                id="weekly-ai-insight"
              >
                AI insight
              </h4>
            </div>
          </div>
          <div className="rounded-[16px] border border-dashboard-accent/30 bg-dashboard-accent-soft/40 px-5 py-4">
            <p className="text-base leading-7 text-dashboard-text sm:text-lg sm:leading-8">
              {insight.narrative}
            </p>
          </div>
        </section>

        <section aria-labelledby="weekly-key-metrics">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-muted">
              Numbers behind the insight
            </p>
            <h4 className="mt-1 text-lg font-semibold text-dashboard-text" id="weekly-key-metrics">
              Key metrics
            </h4>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map(([label, value]) => (
              <div
                className="rounded-[14px] border border-dashboard-border bg-[var(--bg-surface-raised)] px-4 py-4"
                key={label}
              >
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-dashboard-muted">
                  {label}
                </dt>
                <dd className="mt-2 text-xl font-semibold text-dashboard-text">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="weekly-activity-patterns">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dashboard-muted">
              When work happened
            </p>
            <h4
              className="mt-1 text-lg font-semibold text-dashboard-text"
              id="weekly-activity-patterns"
            >
              Activity patterns
            </h4>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[16px] border border-dashboard-border bg-[var(--bg-surface-raised)] p-5">
              <h5 className="font-semibold text-dashboard-text">Daily productivity</h5>
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
              <h5 className="font-semibold text-dashboard-text">Productive hours</h5>
              <p className="mt-1 text-sm text-dashboard-muted">Activity by hour · {metrics.timezone}</p>
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
