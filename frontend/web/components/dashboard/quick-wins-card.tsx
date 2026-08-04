import type { DashboardTaskSummary } from '../../lib/dashboard';
import { DashboardTaskCard } from './dashboard-task-card';

export function QuickWinsCard({
  tasks,
}: Readonly<{
  tasks: DashboardTaskSummary[];
}>) {
  return (
    <section className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-dashboard-text">Quick Wins</h2>
        <span className="rounded-[var(--radius-pill)] bg-dashboard-bg/60 px-3 py-1 text-xs font-medium text-dashboard-muted">
          {tasks.length}/5
        </span>
      </div>

      {tasks.length ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <DashboardTaskCard compact key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-dashboard-border bg-dashboard-bg/25 p-5 text-sm text-dashboard-muted">
          No estimated tasks of 10 minutes or less.
        </p>
      )}
    </section>
  );
}
