import type { DashboardWeeklyActivityPoint } from '../../lib/dashboard';

export function WeeklyActivityCard({
  points,
}: Readonly<{
  points: DashboardWeeklyActivityPoint[];
}>) {
  const max = Math.max(
    1,
    ...points.map((point) => point.done + point.overdue),
  );

  return (
    <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-dashboard-text">Weekly Activity</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-dashboard-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-dashboard-accent" />
            Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--red-light)]" />
            Overdue
          </span>
        </div>
      </div>

      <div className="mt-6 grid h-48 grid-cols-7 items-end gap-3">
        {points.map((point) => {
          const doneHeight = Math.max(8, (point.done / max) * 100);
          const overdueHeight = Math.max(0, (point.overdue / max) * 100);

          return (
            <div className="flex h-full min-w-0 flex-col items-center justify-end gap-2" key={point.date}>
              <div className="flex h-36 w-full max-w-8 flex-col justify-end overflow-hidden rounded-[var(--radius-xs)] bg-dashboard-bg/70">
                {point.overdue > 0 ? (
                  <span
                    className="block w-full bg-[var(--red-light)]"
                    style={{ height: `${overdueHeight}%` }}
                  />
                ) : null}
                <span
                  className="block w-full bg-dashboard-accent"
                  style={{ height: `${doneHeight}%` }}
                />
              </div>
              <span className="text-xs font-medium text-dashboard-muted">{point.day}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
