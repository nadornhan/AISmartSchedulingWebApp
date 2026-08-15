import type { DashboardTaskSummary } from '../../lib/dashboard';
import { CheckIcon } from '../layout/icons';
import { DashboardTaskCard } from './dashboard-task-card';

export function QuickWinsCard({
  completingTaskId,
  onComplete,
  tasks,
}: Readonly<{
  completingTaskId?: string | null;
  onComplete: (taskId: string) => void;
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
            <div className="flex items-start gap-3" key={task.id}>
              <button
                aria-label={`Complete ${task.title}`}
                className="mt-4 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border border-dashboard-border-strong bg-[var(--bg-input)] text-transparent transition hover:border-dashboard-accent hover:bg-dashboard-accent hover:text-dashboard-bg disabled:cursor-not-allowed disabled:opacity-50"
                disabled={completingTaskId === task.id}
                onClick={() => onComplete(task.id)}
                type="button"
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <DashboardTaskCard compact task={task} />
              </div>
            </div>
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
