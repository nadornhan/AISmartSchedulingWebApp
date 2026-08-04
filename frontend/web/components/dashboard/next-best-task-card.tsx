import type { DashboardNextBestTask } from '../../lib/dashboard';
import { DashboardTaskCard } from './dashboard-task-card';

export function NextBestTaskCard({
  item,
}: Readonly<{
  item: DashboardNextBestTask | null;
}>) {
  return (
    <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-dashboard-text">Next Best Task</h2>
      </div>

      {item ? (
        <div className="space-y-3">
          <DashboardTaskCard compact task={item.task} />
          <div className="flex flex-wrap gap-2">
            {item.reasons.map((reason) => (
              <span
                className="rounded-[var(--radius-pill)] border border-dashboard-border bg-dashboard-bg/45 px-3 py-1 text-xs font-medium text-dashboard-muted"
                key={reason}
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-dashboard-border bg-dashboard-bg/25 p-5 text-sm text-dashboard-muted">
          No active task to prioritize.
        </p>
      )}
    </section>
  );
}
