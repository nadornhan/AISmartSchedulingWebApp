import { formatDurationLabel } from '../../lib/duration';
import type { DashboardTaskSummary } from '../../lib/dashboard';
import { CalendarIcon, ClockIcon } from '../layout/icons';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDueDate(value: string | null, includeTime = true) {
  if (!value) return 'No due date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
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
  showSubtaskProgress = true,
  showOverdue = true,
  variant = 'default',
  task,
}: Readonly<{
  action?: React.ReactNode;
  compact?: boolean;
  showSubtaskProgress?: boolean;
  showOverdue?: boolean;
  variant?: 'default' | 'recommendation';
  task: DashboardTaskSummary;
}>) {
  const isRecommendation = variant === 'recommendation';
  const hasSubtaskProgress = task.subtask_progress.total > 0;
  const subtaskProgress =
    showSubtaskProgress && hasSubtaskProgress
      ? `${task.subtask_progress.completed}/${task.subtask_progress.total} subtasks${
          task.subtask_progress.percent !== null
            ? ` (${task.subtask_progress.percent}%)`
            : ''
        }`
      : null;
  const priorityBadge = (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-medium',
        isRecommendation && 'px-3.5 py-1.5 text-sm',
        priorityClass(task.priority),
      )}
    >
      {priorityLabel(task.priority)}
    </span>
  );

  return (
    <article
      className={cn(
        'relative rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface/70 p-4',
        isRecommendation &&
          'rounded-[var(--radius-md)] border-dashboard-border/80 bg-[rgb(var(--dashboard-surface-rgb)/0.72)] p-5 shadow-sm backdrop-blur-sm sm:p-6',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div>
            <h3
              className={cn(
                'whitespace-normal break-words text-sm font-semibold leading-5 text-dashboard-text',
                isRecommendation && 'font-poppins text-lg leading-6 sm:text-xl',
              )}
            >
              {task.title}
              {!isRecommendation && showOverdue && task.is_overdue ? (
                <span className="ml-2 inline-flex whitespace-nowrap rounded-full border border-[var(--red-border)] bg-[var(--red-soft)] px-2 py-0.5 align-middle text-[11px] font-semibold leading-4 text-[var(--red-light)]">
                  Overdue
                </span>
              ) : null}
            </h3>
          </div>
        </div>
        {isRecommendation ? (
          priorityBadge
        ) : action ? (
          <div className="shrink-0">{action}</div>
        ) : null}
      </div>

      <div
        className={cn(
          'mt-2 flex flex-wrap items-center gap-2 text-xs text-dashboard-muted',
          isRecommendation &&
            'mt-3 flex min-w-0 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap text-sm',
        )}
      >
        <span
          className={cn(
            'inline-flex items-center gap-1.5',
            isRecommendation && 'min-w-0 max-w-[45%] shrink',
          )}
        >
          <span
            className="h-2 w-2 rounded-full bg-dashboard-muted"
            style={task.project ? { backgroundColor: task.project.color } : undefined}
          />
          <span className={isRecommendation ? 'truncate' : undefined}>
            {task.project?.name ?? 'Unassigned'}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          {isRecommendation ? <CalendarIcon className="h-4 w-4 shrink-0" /> : null}
          {formatDueDate(task.due_date, !isRecommendation)}
        </span>
        {subtaskProgress ? <span>{subtaskProgress}</span> : null}
        {!hasSubtaskProgress && task.estimated_duration_minutes !== null ? (
          <span
            className="inline-flex items-center gap-1.5"
            aria-label={`Estimated duration: ${formatDurationLabel(task.estimated_duration_minutes)}`}
          >
            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
            {formatDurationLabel(task.estimated_duration_minutes)}
          </span>
        ) : null}
        {isRecommendation && showOverdue && task.is_overdue ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[var(--red-light)]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--red-light)]" />
            <span>Overdue</span>
          </span>
        ) : null}
      </div>

      {!isRecommendation ? (
        <div className={cn('mt-3 flex flex-wrap gap-2', compact && 'mt-2')}>{priorityBadge}</div>
      ) : null}
    </article>
  );
}
