import { formatDurationLabel } from '../../lib/duration';
import type { DashboardTaskSummary } from '../../lib/dashboard';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDueDate(value: string | null) {
  if (!value) return 'No due date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function priorityClass(priority: DashboardTaskSummary['priority']) {
  return {
    no_priority: 'border-dashboard-border bg-[var(--bg-surface-raised)] text-dashboard-muted',
    low: 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]',
    medium: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--orange-light)]',
    high: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[priority];
}

function priorityLabel(priority: DashboardTaskSummary['priority']) {
  return {
    no_priority: 'No priority',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  }[priority];
}

export function DashboardTaskCard({
  action,
  compact = false,
  task,
}: Readonly<{
  action?: React.ReactNode;
  compact?: boolean;
  task: DashboardTaskSummary;
}>) {
  return (
    <article className="rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="whitespace-normal break-words text-sm font-semibold leading-5 text-dashboard-text">
            {task.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-dashboard-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full bg-dashboard-muted"
                style={task.project ? { backgroundColor: task.project.color } : undefined}
              />
              {task.project?.name ?? 'Unassigned'}
            </span>
            <span>{formatDueDate(task.due_date)}</span>
            {task.estimated_duration_minutes !== null ? (
              <span>{formatDurationLabel(task.estimated_duration_minutes)}</span>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className={cn('mt-3 flex flex-wrap gap-2', compact && 'mt-2')}>
        <span
          className={cn(
            'inline-flex rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-medium',
            priorityClass(task.priority),
          )}
        >
          {priorityLabel(task.priority)}
        </span>
        {task.is_overdue ? (
          <span className="inline-flex rounded-[var(--radius-pill)] border border-[var(--red-border)] bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-light)]">
            Overdue
          </span>
        ) : null}
      </div>
    </article>
  );
}
