'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  getInsightsSummary,
  type InsightRecommendation,
  type InsightsSummary,
} from '../../lib/analytics';
import { onSettingsDataChanged, onTaskDataChanged } from '../../lib/data-events';
import {
  acceptSuggestion,
  adjustSuggestion,
  applySuggestions,
  dismissSuggestion,
  regenerateSchedulingPlan,
  type ScheduleSuggestion,
  type SchedulingPlan,
} from '../../lib/scheduling';
import { formatScheduleSuggestionRange } from '../../lib/scheduling-format';

function formatWeeklySummary(summary: InsightsSummary) {
  const change = summary.week_over_week_change_percent;
  if (summary.tasks_completed_this_week === 0) {
    return summary.weekly_summary_text;
  }

  if (change === null) {
    return (
      <>
        You&apos;ve completed <strong>{summary.tasks_completed_this_week} tasks</strong> this
        week — great start compared with last week!
      </>
    );
  }

  const absolute = Math.abs(change);
  const direction = change >= 0 ? 'more' : 'fewer';

  return (
    <>
      You&apos;ve completed <strong>{summary.tasks_completed_this_week} tasks</strong> this week,
      that&apos;s <span className="font-semibold text-[var(--accent)]">{absolute}%</span> {direction}{' '}
      than last week!
    </>
  );
}

function TrendChart({ points }: { points: InsightsSummary['trend'] }) {
  const max = Math.max(1, ...points.map((point) => point.completed_count));
  const width = 320;
  const height = 120;
  const padding = 8;

  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.completed_count / max) * (height - padding * 2);
    return { x, y, count: point.completed_count };
  });

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const area = `${path} L ${coordinates.at(-1)?.x ?? width} ${height - padding} L ${
    coordinates[0]?.x ?? padding
  } ${height - padding} Z`;

  const last = coordinates.at(-1);

  return (
    <svg aria-hidden className="h-[120px] w-full max-w-[340px]" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="insightsTrendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(53, 227, 181, 0.35)" />
          <stop offset="100%" stopColor="rgba(53, 227, 181, 0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#insightsTrendFill)" />
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {last ? (
        <>
          <circle cx={last.x} cy={last.y} fill="var(--accent)" r="5" />
          <text
            fill="var(--accent)"
            fontSize="16"
            textAnchor="middle"
            x={last.x}
            y={Math.max(18, last.y - 12)}
          >
            ★
          </text>
        </>
      ) : null}
    </svg>
  );
}

function recommendationAccent(category: InsightRecommendation['category']) {
  if (category === 'schedule') {
    return {
      ring: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
      icon: '✦',
    };
  }
  if (category === 'deep_focus') {
    return {
      ring: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
      icon: '⏱',
    };
  }
  if (category === 'consistency') {
    return {
      ring: 'border-[var(--yellow-soft)] bg-[var(--yellow-soft)] text-[var(--yellow)]',
      icon: '📅',
    };
  }
  return {
    ring: 'border-[var(--purple-border)] bg-[var(--purple-soft)] text-[var(--purple)]',
    icon: '☕',
  };
}

export function InsightsDashboard() {
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [plan, setPlan] = useState<SchedulingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustStart, setAdjustStart] = useState('');
  const [adjustEnd, setAdjustEnd] = useState('');

  async function load(signal?: AbortSignal) {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getInsightsSummary(signal);
      setSummary(data);
      setPlan(data.scheduling_plan);
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(
        requestError instanceof Error ? requestError.message : 'Could not load insights.',
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const unsubscribeTasks = onTaskDataChanged(() => {
      void load();
    });
    const unsubscribeSettings = onSettingsDataChanged(() => {
      void load();
    });

    return () => {
      controller.abort();
      unsubscribeTasks();
      unsubscribeSettings();
    };
  }, []);

  const recommendationCards = useMemo(() => summary?.recommendations ?? [], [summary]);

  async function handleRegenerate() {
    setIsMutating(true);
    try {
      const next = await regenerateSchedulingPlan();
      setPlan(next);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to regenerate.');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAccept(suggestion: ScheduleSuggestion) {
    setIsMutating(true);
    try {
      const updated = await acceptSuggestion(suggestion.id);
      setPlan((current) =>
        current
          ? {
              ...current,
              schedule: current.schedule.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDismiss(suggestion: ScheduleSuggestion) {
    setIsMutating(true);
    try {
      await dismissSuggestion(suggestion.id);
      setPlan((current) =>
        current
          ? {
              ...current,
              schedule: current.schedule.filter((item) => item.id !== suggestion.id),
            }
          : current,
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleApply() {
    setIsMutating(true);
    try {
      const next = await applySuggestions();
      setPlan(next);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to apply schedule to calendar.',
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleAdjustSave(suggestionId: string) {
    if (!adjustStart || !adjustEnd) return;
    setIsMutating(true);
    try {
      const start = new Date(adjustStart);
      const end = new Date(adjustEnd);
      const updated = await adjustSuggestion(suggestionId, {
        suggested_start: start.toISOString(),
        suggested_end: end.toISOString(),
      });
      setPlan((current) =>
        current
          ? {
              ...current,
              schedule: current.schedule.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      setAdjustingId(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to adjust suggestion.',
      );
    } finally {
      setIsMutating(false);
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/70 p-8 text-sm text-dashboard-muted">
        Generating your AI insights…
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--red-border)] bg-[var(--red-soft)] p-6 text-sm text-[var(--red-light)]">
        {error}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[20px] border border-dashboard-border bg-dashboard-surface p-6 shadow-panel sm:p-8">
        <div className="mb-4 flex justify-end">
          <span className="rounded-[var(--radius-pill)] border border-dashboard-accent/40 bg-dashboard-accent-soft px-3 py-1 text-[11px] font-medium text-dashboard-accent">
            {summary.footnote || 'AI based on your patterns'}
          </span>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-start">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-[var(--accent-soft)] text-2xl">
                🌱
              </div>
              <h2 className="text-[28px] font-bold tracking-[var(--tracking-heading)] text-dashboard-text sm:text-[32px]">
                {summary.greeting}
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-dashboard-muted">
              {formatWeeklySummary(summary)}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 lg:items-end">
            <TrendChart points={summary.trend} />
            <p className="max-w-xs text-right text-sm italic text-dashboard-subtle">
              {summary.motivational_quote}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-dashboard-muted">This week</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon="✓"
              iconClass="bg-[var(--accent-soft)] text-[var(--accent)]"
              label="Tasks Completed"
              value={String(summary.tasks_completed_this_week)}
            />
            <StatCard
              icon="⌛"
              iconClass="bg-[var(--blue-soft)] text-[var(--blue-light)]"
              label="Estimated Work"
              value={summary.estimated_work_time_label}
            />
            <StatCard
              icon="◎"
              iconClass="bg-[var(--purple-soft)] text-[var(--purple-light)]"
              label="Goal Progress"
              value={`${summary.goal_progress_percent}%`}
            />
          </div>
        </div>
      </section>

      <section
        className="rounded-[20px] border border-dashboard-border bg-dashboard-surface p-6 shadow-panel"
        data-schedule-section
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-dashboard-text">Suggested schedule</h3>
            <p className="mt-1 text-sm text-dashboard-muted">
              Review, adjust, accept, or dismiss slots before applying them to your calendar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border px-4 text-sm text-dashboard-muted transition hover:text-dashboard-text"
              disabled={isMutating}
              onClick={() => void handleRegenerate()}
              type="button"
            >
              Regenerate
            </button>
            <button
              className="h-10 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-4 text-sm font-semibold text-[#04110d]"
              disabled={isMutating || !plan?.schedule.length}
              onClick={() => void handleApply()}
              type="button"
            >
              Apply to calendar
            </button>
          </div>
        </div>

        {plan?.recommendation ? (
          <div className="mt-5 rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-bg/25 p-4">
            <p className="text-sm font-semibold text-dashboard-text">{plan.recommendation.title}</p>
            <p className="mt-1 text-sm text-dashboard-muted">{plan.recommendation.explanation}</p>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {plan?.schedule.length ? (
            plan.schedule.map((suggestion) => (
              <article
                className="rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-surface-raised)] p-4"
                key={suggestion.id}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-dashboard-text">
                      {suggestion.task_title}
                    </p>
                    <p className="mt-1 text-xs text-dashboard-muted">
                      {formatScheduleSuggestionRange(
                        suggestion.suggested_start,
                        suggestion.suggested_end,
                      )}
                      {suggestion.project_name ? ` · ${suggestion.project_name}` : ''}
                      {suggestion.status === 'adjusted' ? ' · Adjusted' : ''}
                    </p>
                    <p className="mt-2 text-xs text-dashboard-muted">{suggestion.explanation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="h-9 rounded-lg border border-dashboard-border px-3 text-xs text-dashboard-muted"
                      disabled={isMutating}
                      onClick={() => {
                        setAdjustingId(suggestion.id);
                        setAdjustStart(suggestion.suggested_start.slice(0, 16));
                        setAdjustEnd(suggestion.suggested_end.slice(0, 16));
                      }}
                      type="button"
                    >
                      Adjust
                    </button>
                    <button
                      className="h-9 rounded-lg border border-dashboard-border px-3 text-xs text-dashboard-muted"
                      disabled={isMutating}
                      onClick={() => void handleAccept(suggestion)}
                      type="button"
                    >
                      Accept
                    </button>
                    <button
                      className="h-9 rounded-lg border border-dashboard-border px-3 text-xs text-[var(--red-light)]"
                      disabled={isMutating}
                      onClick={() => void handleDismiss(suggestion)}
                      type="button"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                {adjustingId === suggestion.id ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      className="h-10 rounded-lg border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text [color-scheme:dark]"
                      onChange={(event) => setAdjustStart(event.target.value)}
                      type="datetime-local"
                      value={adjustStart}
                    />
                    <input
                      className="h-10 rounded-lg border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text [color-scheme:dark]"
                      onChange={(event) => setAdjustEnd(event.target.value)}
                      type="datetime-local"
                      value={adjustEnd}
                    />
                    <button
                      className="h-10 rounded-lg bg-dashboard-accent px-4 text-sm font-semibold text-[#04110d]"
                      disabled={isMutating}
                      onClick={() => void handleAdjustSave(suggestion.id)}
                      type="button"
                    >
                      Save
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-dashboard-border p-5 text-sm text-dashboard-muted">
              No suggested schedule yet. Create open tasks with estimates, or regenerate.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-xl font-semibold tracking-[var(--tracking-heading)] text-dashboard-text">
          How to boost your productivity
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {recommendationCards.map((item) => {
            const accent = recommendationAccent(item.category);
            return (
              <article
                className="rounded-[18px] border border-dashboard-border bg-dashboard-surface p-5 shadow-panel"
                key={item.id}
              >
                <div
                  className={`mb-4 grid size-11 place-items-center rounded-full border text-lg ${accent.ring}`}
                >
                  {accent.icon}
                </div>
                <h4 className="text-base font-semibold text-dashboard-text">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-dashboard-muted">{item.description}</p>
                <button
                  className="mt-4 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
                  onClick={() => {
                    if (item.category === 'schedule') {
                      document
                        .querySelector('[data-schedule-section]')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  type="button"
                >
                  {item.cta_label} →
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[18px] border border-dashboard-border bg-dashboard-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            ♥
          </div>
          <p className="max-w-3xl text-sm leading-6 text-dashboard-muted">{summary.footer_message}</p>
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
    <div className="rounded-[16px] border border-dashboard-border bg-[var(--bg-surface-raised)] p-4">
      <div className="flex items-center gap-3">
        <div className={`grid size-10 place-items-center rounded-full text-sm font-bold ${iconClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-dashboard-muted">{label}</p>
          <p className="text-2xl font-bold tracking-[var(--tracking-heading)] text-dashboard-text">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
