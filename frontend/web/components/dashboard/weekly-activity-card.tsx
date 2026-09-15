import Link from 'next/link';

import type { DashboardWeeklyActivityPoint } from '../../lib/dashboard';

export function WeeklyActivityCard({
  points,
}: Readonly<{
  points: DashboardWeeklyActivityPoint[];
}>) {
  const max = Math.max(
    8,
    ...points.flatMap((point) => [point.done, point.overdue]),
  );
  const topDone = Math.max(0, ...points.map((point) => point.done));
  const topDays = points
    .filter((point) => point.done === topDone && topDone > 0)
    .map((point) => point.day);
  const insightDays =
    topDays.length === 0
      ? 'your active days'
      : topDays.length === 1
        ? topDays[0]
        : `${topDays.slice(0, -1).join(', ')} and ${topDays.at(-1)}`;

  return (
    <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-6 shadow-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-dashboard-text">Weekly Activity</h2>
          <p className="mt-2 text-sm text-dashboard-muted">
            You&apos;re more productive on {insightDays}
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm text-dashboard-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-dashboard-accent" />
            Completed
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[var(--red-light)]" />
            Overdue
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[32px_minmax(0,1fr)] gap-4">
        <div className="grid h-52 grid-rows-5 text-xs font-medium text-dashboard-muted">
          {[max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0].map(
            (tick) => (
              <span key={tick}>{tick}</span>
            ),
          )}
        </div>
        <div className="relative grid h-52 grid-cols-7 items-end gap-3">
          <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
            <span className="border-t opacity-30 border-dashboard-border/60" />
            <span className="border-t opacity-30 border-dashboard-border/60" />
            <span className="border-t opacity-30 border-dashboard-border/60" />
            <span className="border-t opacity-30 border-dashboard-border/60" />
          </div>
        {points.map((point) => {
          const doneHeight = point.done > 0 ? Math.max(12, (point.done / max) * 100) : 0;
          const overdueHeight =
            point.overdue > 0 ? Math.max(12, (point.overdue / max) * 100) : 0;

          return (
            <div className="relative z-10 flex h-full min-w-0 flex-col items-center justify-end gap-3" key={point.date}>
              <div className="flex h-44 w-full items-end justify-center gap-1.5">
                <div className="flex h-full w-4 flex-col items-center justify-end gap-1">
                  {point.done > 0 ? (
                    <span className="text-xs font-semibold text-dashboard-text">{point.done}</span>
                  ) : null}
                  <span
                    className="w-full rounded-t-[var(--radius-xs)] bg-dashboard-accent shadow-[0_0_14px_rgba(53,227,181,.18)]"
                    style={{ height: `${doneHeight}%` }}
                  />
                </div>
                <div className="flex h-full w-4 flex-col items-center justify-end gap-1">
                  {point.overdue > 0 ? (
                    <span className="text-xs font-semibold text-dashboard-text">
                      {point.overdue}
                    </span>
                  ) : null}
                  <span
                    className="w-full rounded-t-[var(--radius-xs)] bg-[var(--red-light)] shadow-[0_0_14px_rgba(255,95,110,.18)]"
                    style={{ height: `${overdueHeight}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-dashboard-muted">{point.day}</span>
            </div>
          );
        })}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-[var(--radius-sm)] bg-dashboard-accent-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-dashboard-muted">
          <span className="font-semibold text-dashboard-accent">Insight:</span> You complete most
          tasks on {insightDays}. Try scheduling deep work on these days.
        </p>
        <Link
          className="text-sm font-semibold text-dashboard-text transition hover:text-dashboard-accent"
          href="/analytics"
        >
          View full insights
        </Link>
      </div>
    </section>
  );
}
