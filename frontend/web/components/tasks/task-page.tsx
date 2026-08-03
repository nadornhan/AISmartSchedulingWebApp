'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listProjects, type Project } from '../../lib/projects';
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskCreateInput,
  type TaskDisplayStatusValue,
  type TaskPriorityValue,
  type TaskResponse,
  type TaskStatusValue,
} from '../../lib/tasks';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  MoreIcon,
  MoveIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
} from '../layout/icons';

type TaskStatus = 'Pending' | 'In Progress' | 'Done';
type TaskPriority = 'No priority' | 'Low' | 'Medium' | 'High';
type TaskFilter = 'All' | TaskStatus | 'Overdue';

type Task = {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  project: string;
  projectColor: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  overdue?: boolean;
};

const filterOrder: TaskFilter[] = ['All', 'Pending', 'In Progress', 'Done', 'Overdue'];
const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Done'];
const pageSize = 8;

const statusToApi: Record<TaskStatus, TaskStatusValue> = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Done: 'done',
};

const filterToApi: Partial<Record<TaskFilter, TaskDisplayStatusValue>> = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Done: 'done',
  Overdue: 'overdue',
};

const priorityToApi: Record<TaskPriority, TaskPriorityValue> = {
  'No priority': 'no_priority',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

const priorityFromApi: Record<TaskPriorityValue, TaskPriority> = {
  no_priority: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

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

  return {
    id: response.id,
    title: response.title,
    description: response.description || 'No description added.',
    projectId: response.project_id,
    project: response.project?.name ?? 'Unassigned',
    projectColor: response.project?.color ?? 'neutral',
    dueDate: formatTaskDueDate(response.due_date),
    priority: priorityFromApi[response.priority],
    status:
      displayStatus === 'done'
        ? 'Done'
        : displayStatus === 'in_progress'
          ? 'In Progress'
          : 'Pending',
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

function statusClass(status: TaskStatus) {
  return {
    Pending: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]',
    'In Progress': 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]',
    Done: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]',
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
  const shouldOpenCreate = searchParams.get('create') === '1';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState<string>(activeProjectId);
  const [sortAscending, setSortAscending] = useState(true);
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
    if (searchQuery) {
      setActiveFilter('All');
    }
  }, [activeProjectId, searchQuery]);

  useEffect(() => {
    setCreateProjectId(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!shouldOpenCreate) return;

    setCreateProjectId(activeProjectId);
    setIsModalOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    const query = params.toString();
    router.replace(query ? `/tasks?${query}` : '/tasks', { scroll: false });
  }, [activeProjectId, router, searchParams, shouldOpenCreate]);

  useEffect(() => {
    function handleOpenCreateTask(event: Event) {
      const detail = (event as CustomEvent<{ projectId?: string | null }>).detail;
      setCreateProjectId(detail?.projectId || activeProjectId || '');
      setIsModalOpen(true);
    }

    window.addEventListener('open-create-task', handleOpenCreateTask);
    return () => window.removeEventListener('open-create-task', handleOpenCreateTask);
  }, [activeProjectId]);

  const refreshTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listTasks({
        projectId: activeProjectId || undefined,
        search: searchQuery || undefined,
        status: filterToApi[activeFilter],
        sortBy: 'due_date',
        sortOrder: sortAscending ? 'asc' : 'desc',
        page,
        pageSize,
      });
      setTasks(response.items.map(toTask));
      setTotalPages(response.total_pages);
      setSelected([]);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setTasks([]);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, activeProjectId, page, searchQuery, sortAscending]);

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
      await Promise.all(selected.map((id) => updateTask(id, { status: 'done' })));
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
      await Promise.all(selected.map(deleteTask));
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

  return (
    <>
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

        <div className="ml-auto flex items-center gap-3">
          <button
            className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface px-4 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text"
            onClick={() => setSortAscending((current) => !current)}
            type="button"
          >
            <SortIcon className="h-4 w-4" />
            Due date
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

      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 shadow-panel">
        <div className="hidden min-h-14 grid-cols-[32px_minmax(240px,1.6fr)_minmax(94px,0.8fr)_minmax(104px,0.85fr)_minmax(92px,0.75fr)_minmax(116px,0.95fr)_76px] items-center gap-2 border-b border-dashboard-border px-4 text-xs font-semibold uppercase tracking-wide text-dashboard-muted lg:grid">
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
            <div className="grid min-h-64 place-items-center px-6 text-center">
              <div>
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dashboard-border border-t-dashboard-accent" />
                <p className="mt-3 text-sm text-dashboard-muted">Loading tasks...</p>
              </div>
            </div>
          ) : visibleTasks.length ? (
            visibleTasks.map((task) => (
              <article
                className={cn(
                  'group grid gap-4 bg-[var(--bg-surface)]/45 px-4 py-5 transition hover:bg-[var(--bg-surface-hover)]/65 lg:grid-cols-[32px_minmax(240px,1.6fr)_minmax(94px,0.8fr)_minmax(104px,0.85fr)_minmax(92px,0.75fr)_minmax(116px,0.95fr)_76px] lg:items-center lg:gap-2',
                  selected.includes(task.id) && 'bg-dashboard-accent-soft',
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

                <label className="relative inline-flex w-fit items-center">
                  <span className="sr-only">Status for {task.title}</span>
                  <select
                    className={cn(
                      'h-9 appearance-none rounded-[var(--radius-pill)] border py-0 pl-3 pr-8 text-xs font-medium outline-none transition focus:ring-2 focus:ring-dashboard-accent/20',
                      statusClass(task.status),
                    )}
                    disabled={isMutating}
                    onChange={(event) =>
                      void changeStatus(task.id, event.target.value as TaskStatus)
                    }
                    value={task.status}
                  >
                    {statuses.map((status) => (
                      <option className="bg-[var(--bg-surface-raised)]" key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5" />
                </label>

                <div className="flex justify-end gap-1 text-dashboard-muted">
                  <button
                    aria-label={`Edit ${task.title}`}
                    className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                    type="button"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`More actions for ${task.title}`}
                    className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-dashboard-surface hover:text-dashboard-text"
                    type="button"
                  >
                    <MoreIcon className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="grid min-h-64 place-items-center px-6 text-center">
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
            {counts[activeFilter] === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, counts[activeFilter])} of {counts[activeFilter]} tasks
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
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-surface px-3 text-dashboard-muted"
            type="button"
          >
            {pageSize} / page
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
      </footer>

      {isModalOpen ? (
        <CreateTaskModal
          initialProjectId={createProjectId}
          isSubmitting={isMutating}
          onClose={() => setIsModalOpen(false)}
          onCreate={addTask}
          projects={projects}
        />
      ) : null}
    </>
  );
}

function CreateTaskModal({
  initialProjectId = '',
  isSubmitting,
  onClose,
  onCreate,
  projects,
}: Readonly<{
  initialProjectId?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (task: TaskCreateInput) => Promise<void>;
  projects: Project[];
}>) {
  const [priority, setPriority] = useState<TaskPriority>('No priority');
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const formData = new FormData(event.currentTarget);
    const projectId = String(formData.get('project') || '');
    const dueDate = String(formData.get('dueDate') || '');
    const dueTime = String(formData.get('dueTime') || '').trim();
    const description = String(formData.get('description') || '').trim();
    let dueDateTime: string | null = null;

    if (dueDate) {
      const normalizedTime = dueTime
        ? dueTime.length === 5
          ? `${dueTime}:00`
          : dueTime
        : '23:59:00';
      const parsedDueDate = new Date(`${dueDate}T${normalizedTime}`);

      if (Number.isNaN(parsedDueDate.getTime())) {
        setSubmitError('Please enter a valid due date and time.');
        return;
      }

      dueDateTime = parsedDueDate.toISOString();
    }

    try {
      await onCreate({
        title: String(formData.get('title')).trim(),
        description: description || null,
        project_id: projectId || null,
        due_date: dueDateTime,
        priority: priorityToApi[priority],
      });
    } catch (requestError) {
      setSubmitError(getErrorMessage(requestError));
    }
  }

  return (
    <div
      aria-labelledby="create-task-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#000306]/80 p-4 backdrop-blur-[5px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <form
        className="my-6 w-full max-w-[620px] rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-[0_32px_100px_rgba(0,0,0,.6)] sm:p-8"
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2
              className="text-2xl font-semibold tracking-[var(--tracking-heading)] text-dashboard-text"
              id="create-task-title"
            >
              Create New Task
            </h2>
            <p className="mt-1 text-sm text-dashboard-muted">Add the details of your task below.</p>
          </div>
          <button
            aria-label="Close create task dialog"
            className="grid h-10 w-10 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-text"
            onClick={onClose}
            type="button"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 space-y-5">
          <Field label="Task Title">
            <input
              autoFocus
              className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-accent bg-[var(--bg-input)] px-4 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:shadow-[0_0_0_3px_rgba(53,227,181,.1)]"
              name="title"
              placeholder="e.g. Finish Q2 Report"
              required
            />
          </Field>

          <Field label="Folder / Project">
            <label className="relative block">
              <span className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-dashboard-muted" />
              <select
                className="h-[var(--input-height-desktop)] w-full appearance-none rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] pl-9 pr-10 text-sm text-dashboard-text outline-none focus:border-dashboard-accent"
                defaultValue={initialProjectId}
                name="project"
              >
                <option value="">Unassigned (Add to Inbox)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dashboard-muted" />
            </label>
          </Field>

          <Field label="Priority">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['No priority', 'Low', 'Medium', 'High'] as TaskPriority[]).map((option) => (
                <button
                  className={cn(
                    'flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border text-sm transition',
                    priority === option
                      ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-text'
                      : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted hover:border-dashboard-border-strong',
                  )}
                  key={option}
                  onClick={() => setPriority(option)}
                  type="button"
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      option === 'No priority' && 'bg-dashboard-muted',
                      option === 'Low' && 'bg-[var(--blue)]',
                      option === 'Medium' && 'bg-[var(--yellow)]',
                      option === 'High' && 'bg-[var(--red)]',
                    )}
                  />
                  {option}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Due Date" optional>
              <label className="relative block">
                <CalendarIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dashboard-muted" />
                <input
                  className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] pl-12 pr-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent"
                  name="dueDate"
                  type="date"
                />
              </label>
            </Field>

            <Field label="Time" optional>
              <input
                className="h-[var(--input-height-desktop)] w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm text-dashboard-muted outline-none [color-scheme:dark] focus:border-dashboard-accent"
                name="dueTime"
                type="time"
              />
            </Field>
          </div>

          <Field label="Notes / Description" optional>
            <textarea
              className="min-h-24 w-full resize-y rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 py-3 text-sm text-dashboard-text outline-none placeholder:text-[var(--text-placeholder)] focus:border-dashboard-accent"
              name="description"
              placeholder="Add any notes or details..."
            />
          </Field>
        </div>

        {submitError ? (
          <p className="mt-5 text-sm text-[var(--red-light)]" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-4">
          <button
            className="h-11 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-5 text-sm font-medium text-dashboard-text transition hover:border-dashboard-border-strong"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex h-11 items-center gap-3 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-6 text-sm font-semibold text-[#04110d] shadow-glow transition hover:brightness-110"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
            <span className="rounded bg-[#04110d]/15 px-1.5 py-0.5 text-xs">⌘↵</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  children,
  label,
  optional,
}: Readonly<{ children: React.ReactNode; label: string; optional?: boolean }>) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-dashboard-text">
        {label}{' '}
        {optional ? <span className="font-normal text-dashboard-muted">(optional)</span> : null}
      </span>
      {children}
    </label>
  );
}
