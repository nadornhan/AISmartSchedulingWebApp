'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { formatDurationLabel } from '../../lib/duration';
import { listProjects, type Project } from '../../lib/projects';
import {
  bulkDeleteTasks,
  bulkUpdateTasks,
  createTask,
  deleteTask,
  duplicateTask,
  getTask,
  listTasks,
  rescheduleTask,
  updateTask,
  type TaskCreateInput,
  type TaskDisplayStatusValue,
  type TaskPriorityValue,
  type TaskResponse,
  type TaskSortValue,
  type TaskStatusValue,
  type TaskUpdateInput,
} from '../../lib/tasks';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  MoreIcon,
  MoveIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
} from '../layout/icons';
import {
  CreateTaskModal,
  EditTaskModal,
  priorityLabelFromApi,
  type TaskPriorityLabel,
} from './create-task-modal';

type TaskStatus = 'Pending' | 'In Progress' | 'Done';
type DisplayTaskStatus = TaskStatus | 'Overdue';
type TaskPriority = TaskPriorityLabel;
type TaskFilter = 'All' | TaskStatus | 'Overdue';
type PriorityFilter = 'All' | TaskPriority;

type Task = {
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

const filterOrder: TaskFilter[] = ['All', 'Pending', 'In Progress', 'Done', 'Overdue'];
const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Done'];
const priorityFilters: PriorityFilter[] = ['All', 'No priority', 'Low', 'Medium', 'High'];
const sortOptions: Array<{ label: string; value: TaskSortValue }> = [
  { label: 'Due date', value: 'due_date' },
  { label: 'Priority', value: 'priority' },
  { label: 'Title', value: 'title' },
  { label: 'Created', value: 'created_at' },
  { label: 'Updated', value: 'updated_at' },
];
const pageSizeOptions = [8, 16, 24];

const statusToApi: Record<TaskStatus, TaskStatusValue> = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Done: 'done',
};

const statusFromApi: Record<TaskStatusValue, TaskStatus> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

const filterToApi: Partial<Record<TaskFilter, TaskDisplayStatusValue>> = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Done: 'done',
  Overdue: 'overdue',
};

const priorityFilterToApi: Partial<Record<PriorityFilter, TaskPriorityValue>> = {
  'No priority': 'no_priority',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

const priorityFromApi = priorityLabelFromApi;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatTaskDueDate(value: string | null) {
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

function toTask(response: TaskResponse): Task {
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

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return 'Your session is missing or has expired. Please sign in again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function priorityClass(priority: TaskPriority) {
  return {
    'No priority': 'border-dashboard-border bg-[var(--bg-surface-raised)] text-dashboard-muted',
    Low: 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]',
    Medium: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--orange-light)]',
    High: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[priority];
}

function statusClass(status: DisplayTaskStatus) {
  return {
    Pending: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]',
    'In Progress': 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]',
    Done: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
    Overdue: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[status];
}

function CheckBox({
  checked,
  label,
  onChange,
}: Readonly<{ checked: boolean; label: string; onChange: () => void }>) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition',
        checked
          ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
          : 'border-dashboard-border-strong bg-[var(--bg-input)] hover:border-dashboard-accent/70',
      )}
      onClick={onChange}
      type="button"
    >
      {checked ? <CheckIcon className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function TaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get('project_id') || '';
  const searchQuery = searchParams.get('search')?.trim() || '';
  const targetTaskId = searchParams.get('task_id') || '';
  const shouldOpenCreate = searchParams.get('create') === '1';
  const createPriorityParam = searchParams.get('priority');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>(activeProjectId);
  const [createPriority, setCreatePriority] = useState<TaskPriority>('No priority');
  const [sortBy, setSortBy] = useState<TaskSortValue>('due_date');
  const [sortAscending, setSortAscending] = useState(true);
  const [pageSize, setPageSize] = useState(8);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleDueDate, setRescheduleDueDate] = useState('');
  const [counts, setCounts] = useState<Record<TaskFilter, number>>({
    All: 0,
    Pending: 0,
    'In Progress': 0,
    Done: 0,
    Overdue: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setSelected([]);
    if (searchQuery || targetTaskId) {
      setActiveFilter('All');
    }
  }, [activeProjectId, searchQuery, targetTaskId]);

  useEffect(() => {
    setCreateProjectId(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!shouldOpenCreate) return;

    setCreateProjectId(activeProjectId);
    if (
      createPriorityParam === 'no_priority' ||
      createPriorityParam === 'low' ||
      createPriorityParam === 'medium' ||
      createPriorityParam === 'high'
    ) {
      setCreatePriority(priorityFromApi(createPriorityParam));
    } else {
      setCreatePriority('No priority');
    }
    setIsModalOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    params.delete('priority');
    const query = params.toString();
    router.replace(query ? `/tasks?${query}` : '/tasks', { scroll: false });
  }, [activeProjectId, createPriorityParam, router, searchParams, shouldOpenCreate]);

  useEffect(() => {
    function handleOpenCreateTask(event: Event) {
      const detail = (
        event as CustomEvent<{ projectId?: string | null; priority?: TaskPriorityValue | null }>
      ).detail;
      setCreateProjectId(detail?.projectId || activeProjectId || '');
      if (detail?.priority) {
        setCreatePriority(priorityFromApi(detail.priority));
      } else {
        setCreatePriority('No priority');
      }
      setIsModalOpen(true);
    }

    window.addEventListener('open-create-task', handleOpenCreateTask);
    return () => window.removeEventListener('open-create-task', handleOpenCreateTask);
  }, [activeProjectId]);

  const refreshTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (targetTaskId) {
        const task = await getTask(targetTaskId);
        setTasks([toTask(task)]);
        setTotalPages(1);
        setSelected([]);
        setMenuTaskId(null);
        return;
      }

      const response = await listTasks({
        projectId: activeProjectId || undefined,
        search: searchQuery || undefined,
        status: filterToApi[activeFilter],
        priority: priorityFilterToApi[priorityFilter],
        sortBy,
        sortOrder: sortAscending ? 'asc' : 'desc',
        page,
        pageSize,
      });
      setTasks(response.items.map(toTask));
      setTotalPages(response.total_pages);
      setSelected([]);
      setMenuTaskId(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setTasks([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeFilter,
    activeProjectId,
    page,
    pageSize,
    priorityFilter,
    searchQuery,
    sortAscending,
    sortBy,
    targetTaskId,
  ]);

  const refreshCounts = useCallback(async () => {
    try {
      const projectId = activeProjectId || undefined;
      const [all, pending, inProgress, done, overdue] = await Promise.all([
        listTasks({ projectId, search: searchQuery || undefined, page: 1, pageSize: 1 }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'pending',
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'in_progress',
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'done',
          page: 1,
          pageSize: 1,
        }),
        listTasks({
          projectId,
          search: searchQuery || undefined,
          status: 'overdue',
          page: 1,
          pageSize: 1,
        }),
      ]);
      setCounts({
        All: all.total,
        Pending: pending.total,
        'In Progress': inProgress.total,
        Done: done.total,
        Overdue: overdue.total,
      });
    } catch {
      // The main task request displays the actionable API error.
    }
  }, [activeProjectId, searchQuery]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    void refreshCounts();
    void listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [refreshCounts]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshTasks();
        void refreshCounts();
      }),
    [refreshCounts, refreshTasks],
  );

  useEffect(
    () =>
      onProjectDataChanged(() => {
        void listProjects()
          .then(setProjects)
          .catch(() => setProjects([]));
        void refreshCounts();
      }),
    [refreshCounts],
  );

  const visibleTasks = tasks;
  const activeProject = projects.find((project) => project.id === activeProjectId);

  const allVisibleSelected =
    visibleTasks.length > 0 && visibleTasks.every((task) => selected.includes(task.id));
  const visibleTotal = targetTaskId ? visibleTasks.length : counts[activeFilter];
  const visibleStart = visibleTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleEnd = targetTaskId ? visibleTasks.length : Math.min(page * pageSize, visibleTotal);

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id],
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleTasks.map((task) => task.id));
      setSelected((current) => current.filter((id) => !visibleIds.has(id)));
      return;
    }

    setSelected((current) => [
      ...current,
      ...visibleTasks.map((task) => task.id).filter((id) => !current.includes(id)),
    ]);
  }

  async function changeStatus(id: string, status: TaskStatus) {
    setIsMutating(true);
    setError(null);
    try {
      await updateTask(id, { status: statusToApi[status] });
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function completeSelected() {
    setIsMutating(true);
    setError(null);
    try {
      await bulkUpdateTasks({ task_ids: selected, status: 'done' });
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteSelected() {
    setIsMutating(true);
    setError(null);
    try {
      await bulkDeleteTasks(selected);
      const shouldGoBack = tasks.length === selected.length && page > 1;
      if (shouldGoBack) {
        setPage((current) => current - 1);
      } else {
        await refreshTasks();
      }
      await refreshCounts();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function moveSelected(projectId: string | null) {
    setIsMutating(true);
    setError(null);
    try {
      await bulkUpdateTasks({ task_ids: selected, project_id: projectId });
      setIsMoveOpen(false);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDuplicate(taskId: string) {
    setIsMutating(true);
    setError(null);
    setMenuTaskId(null);
    try {
      await duplicateTask(taskId);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteOne(taskId: string) {
    setIsMutating(true);
    setError(null);
    setMenuTaskId(null);
    try {
      await deleteTask(taskId);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleTaskId || !rescheduleDueDate) return;

    setIsMutating(true);
    setError(null);
    try {
      const dueDateTime = new Date(`${rescheduleDueDate}T23:59:00`);
      await rescheduleTask(rescheduleTaskId, {
        due_date: Number.isNaN(dueDateTime.getTime()) ? null : dueDateTime.toISOString(),
      });
      setRescheduleTaskId(null);
      setRescheduleDueDate('');
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsMutating(false);
    }
  }

  function openReschedule(task: Task) {
    setMenuTaskId(null);
    setRescheduleTaskId(task.id);
    setRescheduleDueDate(task.dueDateIso ? task.dueDateIso.slice(0, 10) : '');
  }

  async function addTask(input: TaskCreateInput) {
    setIsMutating(true);
    setError(null);
    try {
      await createTask(input);
      setIsModalOpen(false);
      setPage(1);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }

  async function editTask(input: TaskUpdateInput) {
    if (!editingTask) return;

    setIsMutating(true);
    setError(null);
    try {
      await updateTask(editingTask.id, input);
      setEditingTask(null);
      await Promise.all([refreshTasks(), refreshCounts()]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }

  function clearProjectFilter() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('project_id');
    const query = nextParams.toString();
    router.push(query ? `/tasks?${query}` : '/tasks');
  }

  function clearSearchFilter() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    const query = nextParams.toString();
    router.push(query ? `/tasks?${query}` : '/tasks');
  }

  function clearTargetTask() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('task_id');
    const query = nextParams.toString();
    router.push(query ? `/tasks?${query}` : '/tasks');
  }

  return (
    <>
      {targetTaskId ? (
        <section
          aria-label="Selected task"
          className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-dashboard-accent/30 bg-dashboard-accent-soft px-4 py-3"
        >
          <p className="text-sm text-dashboard-muted">
            Showing selected task{' '}
            {visibleTasks[0]?.id === targetTaskId ? (
              <span className="font-semibold text-dashboard-text">{visibleTasks[0].title}</span>
            ) : null}
          </p>
          <button
            className="ml-auto rounded-[var(--radius-sm)] border border-dashboard-border px-3 py-1.5 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-accent/50 hover:text-dashboard-accent"
            onClick={clearTargetTask}
            type="button"
          >
            Clear
          </button>
        </section>
      ) : null}

      {activeProjectId ? (
        <section
          aria-label="Active folder filter"
          className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-surface/55 px-4 py-3"
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: activeProject?.color ?? 'var(--dashboard-muted)' }}
          />
          <p className="text-sm text-dashboard-muted">
            Showing tasks in{' '}
            <span className="font-semibold text-dashboard-text">
              {activeProject?.name ?? 'selected folder'}
            </span>
          </p>
          <button
            className="ml-auto rounded-[var(--radius-sm)] border border-dashboard-border px-3 py-1.5 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-accent/50 hover:text-dashboard-accent"
            onClick={clearProjectFilter}
            type="button"
          >
            Clear
          </button>
        </section>
      ) : null}

      {searchQuery ? (
        <section
          aria-label="Active task search"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-surface/55 px-4 py-3"
        >
          <p className="text-sm text-dashboard-muted">
            Searching tasks for{' '}
            <span className="font-semibold text-dashboard-text">{searchQuery}</span>
          </p>
          <button
            className="ml-auto rounded-[var(--radius-sm)] border border-dashboard-border px-3 py-1.5 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-accent/50 hover:text-dashboard-accent"
            onClick={clearSearchFilter}
            type="button"
          >
            Clear
          </button>
        </section>
      ) : null}

      <section aria-label="Task controls" className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex max-w-full gap-2 overflow-x-auto rounded-[var(--radius-xl)] border border-dashboard-border bg-dashboard-surface/70 p-2">
          {filterOrder.map((filter) => (
            <button
              aria-pressed={activeFilter === filter}
              className={cn(
                'flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border px-4 text-sm font-medium transition',
                activeFilter === filter
                  ? 'border-dashboard-accent/60 bg-dashboard-accent-soft text-dashboard-accent shadow-[0_0_18px_rgba(53,227,181,0.09)]'
                  : 'border-dashboard-border bg-transparent text-dashboard-muted hover:border-dashboard-border-strong hover:text-dashboard-text',
              )}
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setPage(1);
              }}
              type="button"
            >
              {filter}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  activeFilter === filter
                    ? 'bg-dashboard-accent/15 text-dashboard-accent'
                    : 'bg-dashboard-raised text-dashboard-muted',
                )}
              >
                {counts[filter]}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="relative">
            <span className="sr-only">Filter by priority</span>
            <select
              className="h-11 appearance-none rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface py-0 pl-4 pr-10 text-sm font-medium text-dashboard-muted outline-none transition hover:border-dashboard-border-strong hover:text-dashboard-text"
              onChange={(event) => {
                setPriorityFilter(event.target.value as PriorityFilter);
                setPage(1);
              }}
              value={priorityFilter}
            >
              {priorityFilters.map((option) => (
                <option key={option} value={option}>
                  {option === 'All' ? 'All priorities' : option}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          </label>

          <label className="relative">
            <span className="sr-only">Sort tasks</span>
            <select
              className="h-11 appearance-none rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface py-0 pl-10 pr-10 text-sm font-medium text-dashboard-muted outline-none transition hover:border-dashboard-border-strong hover:text-dashboard-text"
              onChange={(event) => setSortBy(event.target.value as TaskSortValue)}
              value={sortBy}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SortIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          </label>

          <button
            aria-label={sortAscending ? 'Sort ascending' : 'Sort descending'}
            className="grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text"
            onClick={() => setSortAscending((current) => !current)}
            type="button"
          >
            <ChevronDownIcon className={cn('h-4 w-4 transition', !sortAscending && 'rotate-180')} />
          </button>

          <button
            className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-[#04110d] shadow-glow transition hover:brightness-110"
            onClick={() => {
              setCreateProjectId(activeProjectId);
              setIsModalOpen(true);
            }}
            type="button"
          >
            <PlusIcon className="h-5 w-5" />
            New Task
          </button>
        </div>
      </section>

      {error ? (
        <div
          className="mb-4 flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-light)]"
          role="alert"
        >
          <span>{error}</span>
          <button
            className="shrink-0 font-semibold underline underline-offset-2"
            onClick={() => void refreshTasks()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 shadow-panel">
        <div className="hidden min-h-14 grid-cols-[32px_minmax(240px,1.6fr)_minmax(94px,0.8fr)_minmax(104px,0.85fr)_minmax(92px,0.75fr)_minmax(116px,0.95fr)_76px] items-center gap-2 rounded-t-[var(--radius-lg)] border-b border-dashboard-border px-4 text-xs font-semibold uppercase tracking-wide text-dashboard-muted lg:grid">
          <CheckBox
            checked={allVisibleSelected}
            label="Select all visible tasks"
            onChange={toggleAllVisible}
          />
          <span>Task</span>
          <span>Project</span>
          <span>Due date</span>
          <span>Priority</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        <div className="divide-y divide-dashboard-border">
          {isLoading ? (
            <div className="grid min-h-64 place-items-center rounded-b-[var(--radius-lg)] px-6 text-center">
              <div>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dashboard-border border-t-dashboard-accent" />
                <p className="mt-3 text-sm text-dashboard-muted">Loading tasks...</p>
              </div>
            </div>
          ) : visibleTasks.length ? (
            visibleTasks.map((task, taskIndex) => (
              <article
                className={cn(
                  'group grid gap-4 bg-[var(--bg-surface)]/45 px-4 py-5 transition hover:bg-[var(--bg-surface-hover)]/65 lg:grid-cols-[32px_minmax(240px,1.6fr)_minmax(94px,0.8fr)_minmax(104px,0.85fr)_minmax(92px,0.75fr)_minmax(116px,0.95fr)_76px] lg:items-center lg:gap-2',
                  selected.includes(task.id) && 'bg-dashboard-accent-soft',
                  targetTaskId === task.id &&
                    'bg-dashboard-accent-soft shadow-[inset_3px_0_0_var(--dashboard-accent)]',
                  menuTaskId === task.id && 'relative z-30',
                  taskIndex === visibleTasks.length - 1 && 'rounded-b-[var(--radius-lg)]',
                )}
                key={task.id}
              >
                <div className="flex items-center gap-3">
                  <CheckBox
                    checked={selected.includes(task.id)}
                    label={`Select ${task.title}`}
                    onChange={() => toggleSelected(task.id)}
                  />
                  {task.status === 'Done' ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-dashboard-accent text-dashboard-bg lg:hidden">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {task.status === 'Done' ? (
                      <span className="hidden h-6 w-6 shrink-0 place-items-center rounded-full bg-dashboard-accent text-dashboard-bg lg:grid">
                        <CheckIcon className="h-4 w-4" />
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="whitespace-normal break-words text-[15px] font-semibold leading-5 text-dashboard-text">
                        {task.title}
                      </h2>
                      <p className="mt-1 truncate text-xs leading-5 text-dashboard-muted">
                        {task.description}
                      </p>
                      {task.subtaskProgressLabel || task.durationLabel ? (
                        <p className="mt-1 text-xs font-medium text-dashboard-muted">
                          {task.subtaskProgressLabel ?? task.durationLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    className={cn(
                      'inline-flex rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium',
                      task.projectId === null &&
                        'bg-[var(--bg-surface-raised)] text-dashboard-muted',
                    )}
                    style={
                      task.projectId
                        ? {
                            backgroundColor: `${task.projectColor}22`,
                            color: task.projectColor,
                          }
                        : undefined
                    }
                  >
                    {task.project}
                  </span>
                </div>

                <p
                  className={cn(
                    'text-sm text-dashboard-muted',
                    task.overdue && 'font-medium text-[var(--red-light)]',
                  )}
                >
                  {task.dueDate}
                </p>

                <div>
                  <span
                    className={cn(
                      'inline-flex rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-medium',
                      priorityClass(task.priority),
                    )}
                  >
                    {task.priority}
                  </span>
                </div>

                <div className="space-y-2">
                  {task.overdue ? (
                    <span
                      className={cn(
                        'inline-flex rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-medium',
                        statusClass('Overdue'),
                      )}
                    >
                      Overdue
                    </span>
                  ) : null}
                  <label className="relative inline-flex w-fit items-center">
                    <span className="sr-only">Status for {task.title}</span>
                    <select
                      className={cn(
                        'h-9 appearance-none rounded-[var(--radius-pill)] border py-0 pl-3 pr-8 text-xs font-medium outline-none transition focus:ring-2 focus:ring-dashboard-accent/20',
                        statusClass(task.workflowStatus),
                      )}
                      disabled={isMutating}
                      onChange={(event) =>
                        void changeStatus(task.id, event.target.value as TaskStatus)
                      }
                      value={task.workflowStatus}
                    >
                      {statuses.map((status) => (
                        <option className="bg-[var(--bg-surface-raised)]" key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5" />
                  </label>
                </div>

                <div className="relative flex justify-end gap-1 text-dashboard-muted">
                  <button
                    aria-label={`Edit ${task.title}`}
                    className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                    onClick={() => setEditingTask(task.source)}
                    type="button"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    aria-expanded={menuTaskId === task.id}
                    aria-label={`More actions for ${task.title}`}
                    className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-dashboard-surface hover:text-dashboard-text"
                    onClick={() =>
                      setMenuTaskId((current) => (current === task.id ? null : task.id))
                    }
                    type="button"
                  >
                    <MoreIcon className="h-4 w-4" />
                  </button>
                  {menuTaskId === task.id ? (
                    <div
                      className={cn(
                        'absolute right-0 z-40 min-w-44 rounded-xl border border-dashboard-border bg-[#071923] p-2 shadow-panel',
                        taskIndex >= visibleTasks.length - 2 ? 'bottom-11' : 'top-11',
                      )}
                    >
                      <button
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                        onClick={() => {
                          setMenuTaskId(null);
                          setEditingTask(task.source);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                        onClick={() => void handleDuplicate(task.id)}
                        type="button"
                      >
                        Duplicate
                      </button>
                      <button
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                        onClick={() => openReschedule(task)}
                        type="button"
                      >
                        Reschedule
                      </button>
                      <button
                        className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--red-light)] transition hover:bg-dashboard-surface"
                        onClick={() => void handleDeleteOne(task.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="grid min-h-64 place-items-center rounded-b-[var(--radius-lg)] px-6 text-center">
              <div>
                <p className="text-base font-semibold text-dashboard-text">No tasks found</p>
                <p className="mt-2 text-sm text-dashboard-muted">
                  Try another filter or create a new task.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-surface/70 p-2">
          <span className="px-2 text-sm text-dashboard-muted">{selected.length} selected</span>
          <button
            className="flex h-9 items-center gap-2 rounded-lg border border-dashboard-border px-3 text-sm text-dashboard-muted transition enabled:hover:border-dashboard-accent/50 enabled:hover:text-dashboard-accent disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selected.length || isMutating}
            onClick={() => void completeSelected()}
            type="button"
          >
            <CheckIcon className="h-4 w-4" />
            Complete
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-lg border border-dashboard-border px-3 text-sm text-dashboard-muted transition enabled:hover:border-dashboard-border-strong enabled:hover:text-dashboard-text disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selected.length || isMutating}
            onClick={() => setIsMoveOpen(true)}
            type="button"
          >
            <MoveIcon className="h-4 w-4" />
            Move
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-lg border border-dashboard-border px-3 text-sm text-dashboard-muted transition enabled:hover:border-[var(--red-border)] enabled:hover:text-[var(--red-light)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selected.length || isMutating}
            onClick={() => void deleteSelected()}
            type="button"
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm text-dashboard-muted">
          <span>
            {visibleStart}–{visibleEnd} of {visibleTotal} tasks
          </span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous page"
              className="grid h-10 w-10 place-items-center rounded-lg border border-dashboard-border bg-dashboard-surface disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter(
                (pageNumber) =>
                  pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - page) <= 1,
              )
              .map((pageNumber) => (
                <button
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-lg border text-sm transition',
                    pageNumber === page
                      ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                      : 'border-dashboard-border bg-dashboard-surface text-dashboard-muted hover:text-dashboard-text',
                  )}
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
            <button
              aria-label="Next page"
              className="grid h-10 w-10 place-items-center rounded-lg border border-dashboard-border bg-dashboard-surface disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              type="button"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <label className="relative">
            <span className="sr-only">Tasks per page</span>
            <select
              className="flex h-10 appearance-none rounded-lg border border-dashboard-border bg-dashboard-surface py-0 pl-3 pr-8 text-dashboard-muted outline-none"
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              value={pageSize}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          </label>
        </div>
      </footer>

      {isModalOpen ? (
        <CreateTaskModal
          initialPriority={createPriority}
          initialProjectId={createProjectId}
          isSubmitting={isMutating}
          onClose={() => setIsModalOpen(false)}
          onCreate={addTask}
          projects={projects}
        />
      ) : null}

      {editingTask ? (
        <EditTaskModal
          isSubmitting={isMutating}
          onClose={() => setEditingTask(null)}
          onUpdate={editTask}
          projects={projects}
          task={editingTask}
        />
      ) : null}

      {isMoveOpen ? (
        <div
          aria-labelledby="move-tasks-title"
          aria-modal="true"
          className="fixed inset-0 z-[300] grid place-items-center bg-[#000306]/80 p-4 backdrop-blur-[5px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsMoveOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-[0_32px_100px_rgba(0,0,0,.6)]">
            <h2 className="text-xl font-semibold text-dashboard-text" id="move-tasks-title">
              Move {selected.length} task{selected.length === 1 ? '' : 's'}
            </h2>
            <p className="mt-1 text-sm text-dashboard-muted">Choose a destination folder.</p>
            <div className="mt-5 space-y-2">
              <button
                className="flex w-full rounded-lg border border-dashboard-border px-4 py-3 text-left text-sm text-dashboard-text transition hover:border-dashboard-accent/50 hover:text-dashboard-accent"
                disabled={isMutating}
                onClick={() => void moveSelected(null)}
                type="button"
              >
                Unassigned (Inbox)
              </button>
              {projects.map((project) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-dashboard-border px-4 py-3 text-left text-sm text-dashboard-text transition hover:border-dashboard-accent/50 hover:text-dashboard-accent"
                  disabled={isMutating}
                  key={project.id}
                  onClick={() => void moveSelected(project.id)}
                  type="button"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  {project.name}
                </button>
              ))}
            </div>
            <button
              className="mt-5 h-10 rounded-[var(--radius-sm)] border border-dashboard-border px-4 text-sm text-dashboard-muted"
              onClick={() => setIsMoveOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {rescheduleTaskId ? (
        <div
          aria-labelledby="reschedule-task-title"
          aria-modal="true"
          className="fixed inset-0 z-[300] grid place-items-center bg-[#000306]/80 p-4 backdrop-blur-[5px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setRescheduleTaskId(null);
              setRescheduleDueDate('');
            }
          }}
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-[0_32px_100px_rgba(0,0,0,.6)]">
            <h2 className="text-xl font-semibold text-dashboard-text" id="reschedule-task-title">
              Reschedule task
            </h2>
            <p className="mt-1 text-sm text-dashboard-muted">Pick a new due date.</p>
            <input
              className="mt-5 h-11 w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none [color-scheme:dark] focus:border-dashboard-accent"
              onChange={(event) => setRescheduleDueDate(event.target.value)}
              type="date"
              value={rescheduleDueDate}
            />
            <div className="mt-5 flex justify-between gap-3">
              <button
                className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border px-4 text-sm text-dashboard-muted"
                onClick={() => {
                  setRescheduleTaskId(null);
                  setRescheduleDueDate('');
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-[#04110d]"
                disabled={!rescheduleDueDate || isMutating}
                onClick={() => void handleReschedule()}
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
