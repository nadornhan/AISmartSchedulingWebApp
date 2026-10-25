import { ApiError } from '../../lib/api';
import { formatDurationLabel } from '../../lib/duration';
import type {
  TaskDisplayStatusValue,
  TaskPriorityValue,
  TaskResponse,
  TaskSortValue,
  TaskStatusValue,
} from '../../lib/tasks';
import { priorityLabelFromApi, type TaskPriorityLabel } from './create-task-modal';

export type TaskStatus = 'Pending' | 'In Progress' | 'Done';
export type DisplayTaskStatus = TaskStatus | 'Overdue';
export type TaskPriority = TaskPriorityLabel;
export type TaskFilter = 'All' | TaskStatus | 'Overdue';
export type PriorityFilter = 'All' | TaskPriority;

export type Task = {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  project: string;
  projectColor: string;
  dueDate: string;
  dueDateIso: string | null;
  durationLabel: string | null;
  subtaskProgressLabel: string | null;
  priority: TaskPriority;
  status: DisplayTaskStatus;
  workflowStatus: TaskStatus;
  source: TaskResponse;
  overdue?: boolean;
};

export const filterOrder: TaskFilter[] = ['All', 'Pending', 'In Progress', 'Done', 'Overdue'];
export const mobileFilterOrder: TaskFilter[] = ['All', 'Done', 'In Progress', 'Pending', 'Overdue'];
export const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Done'];
export const priorityFilters: PriorityFilter[] = ['All', 'No priority', 'Low', 'Medium', 'High'];
export const sortOptions: Array<{ label: string; value: TaskSortValue }> = [
  { label: 'Due date', value: 'due_date' },
  { label: 'Priority', value: 'priority' },
  { label: 'Title', value: 'title' },
  { label: 'Project', value: 'project' },
  { label: 'Status', value: 'status' },
  { label: 'Created', value: 'created_at' },
  { label: 'Updated', value: 'updated_at' },
];
export const pageSizeOptions = [8, 16, 24];

export function nextTaskSort(
  currentColumn: TaskSortValue,
  ascending: boolean,
  column: TaskSortValue,
) {
  return { sortBy: column, sortAscending: column === currentColumn ? !ascending : true };
}

export const statusToApi: Record<TaskStatus, TaskStatusValue> = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Done: 'done',
};

const statusFromApi: Record<TaskStatusValue, TaskStatus> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

export const filterToApi: Partial<Record<TaskFilter, TaskDisplayStatusValue>> = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Done: 'done',
  Overdue: 'overdue',
};

export const priorityFilterToApi: Partial<Record<PriorityFilter, TaskPriorityValue>> = {
  'No priority': 'no_priority',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

export const priorityFromApi = priorityLabelFromApi;

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function formatTaskDueDate(value: string | null) {
  if (!value) return 'No due date';

  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();

  const day = isSameDay(date, today)
    ? 'Today'
    : isSameDay(date, tomorrow)
      ? 'Tomorrow'
      : new Intl.DateTimeFormat('en-AU', {
          day: 'numeric',
          month: 'short',
        }).format(date);
  const time = new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${day}, ${time}`;
}

export function toTask(response: TaskResponse): Task {
  const displayStatus = response.status;
  const workflowStatus =
    response.workflow_status ??
    (displayStatus === 'overdue'
      ? 'pending'
      : displayStatus === 'done' || displayStatus === 'in_progress'
        ? displayStatus
        : 'pending');
  const subtaskProgress =
    response.subtask_progress.total > 0
      ? `${response.subtask_progress.completed}/${response.subtask_progress.total} subtasks${
          response.subtask_progress.percent !== null
            ? ` (${response.subtask_progress.percent}%)`
            : ''
        }`
      : null;

  return {
    id: response.id,
    title: response.title,
    description: response.description || 'No description added.',
    projectId: response.project_id,
    project: response.project?.name ?? 'Unassigned',
    projectColor: response.project?.color ?? 'neutral',
    dueDate: formatTaskDueDate(response.due_date),
    dueDateIso: response.due_date,
    durationLabel:
      response.estimated_duration_minutes !== null
        ? formatDurationLabel(response.estimated_duration_minutes)
        : null,
    subtaskProgressLabel: subtaskProgress,
    priority: priorityFromApi(response.priority),
    status: displayStatus === 'overdue' ? 'Overdue' : statusFromApi[workflowStatus],
    workflowStatus: statusFromApi[workflowStatus],
    source: response,
    overdue: displayStatus === 'overdue',
  };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return 'Your session is missing or has expired. Please sign in again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function priorityClass(priority: TaskPriority) {
  return {
    'No priority': 'border-dashboard-border bg-[var(--bg-surface-raised)] text-dashboard-muted',
    Low: 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]',
    Medium: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--orange-light)]',
    High: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[priority];
}

export function statusClass(status: DisplayTaskStatus) {
  return {
    Pending: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
    'In Progress': 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]',
    Done: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
    Overdue: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[status];
}

export function statusOptionClass(status: TaskStatus) {
  return {
    Pending:
      'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)] hover:border-[var(--red-light)] hover:brightness-125',
    'In Progress':
      'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)] hover:border-[var(--yellow)] hover:brightness-125',
    Done: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)] hover:border-[var(--accent)] hover:brightness-125',
  }[status];
}

export type MobileTaskGroup = 'Overdue' | 'Today' | 'Upcoming' | 'Other';

export const mobileGroupMeta: Record<MobileTaskGroup, { color: string; label: string }> = {
  Overdue: { color: 'text-[var(--red-light)]', label: 'Overdue' },
  Today: { color: 'text-dashboard-accent', label: 'Today' },
  Upcoming: { color: 'text-[var(--blue-light)]', label: 'Upcoming' },
  Other: { color: 'text-dashboard-muted', label: 'Other tasks' },
};

export function mobileGroupForTask(task: Task): MobileTaskGroup {
  if (task.overdue) return 'Overdue';
  if (!task.dueDateIso) return 'Other';

  const dueDate = new Date(task.dueDateIso);
  const today = new Date();
  const sameDay =
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate();

  if (sameDay) return 'Today';
  if (dueDate.getTime() > today.getTime()) return 'Upcoming';
  return 'Other';
}
