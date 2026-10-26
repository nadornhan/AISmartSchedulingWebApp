'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { type TaskPriorityValue, type TaskResponse, type TaskSortValue } from '../../lib/tasks';
import { SearchBox } from '../layout/header';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  MoveIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
} from '../layout/icons';
import { CreateTaskModal, EditTaskModal } from './create-task-modal';
import { TaskFilterMenu, type TaskDueDateRange } from './task-filter-menu';

import { TaskDesktopTable, TaskMobileList } from './task-list-views';
import { useTaskPageData } from './use-task-page-data';
import { useTaskPageActions } from './use-task-page-actions';
import {
  cn,
  filterOrder,
  mobileFilterOrder,
  mobileGroupForTask,
  nextTaskSort,
  priorityFilters,
  priorityFromApi,
  sortOptions,
  type PriorityFilter,
  type TaskFilter,
  type TaskPriority,
} from './task-page-model';

const mobileTaskQuery = '(max-width: 1023px)';
function subscribeToTaskViewport(listener: () => void) {
  const media = window.matchMedia(mobileTaskQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const getMobileTaskViewport = () => window.matchMedia(mobileTaskQuery).matches;
const getServerTaskViewport = () => null;

export function TaskPage() {
  const router = useRouter();
  const isMobile = useSyncExternalStore(
    subscribeToTaskViewport,
    getMobileTaskViewport,
    getServerTaskViewport,
  );
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get('project_id') || '';
  const searchQuery = searchParams.get('search')?.trim() || '';
  const targetTaskId = searchParams.get('task_id') || '';
  const pageSize = 8;
  const shouldOpenCreate = searchParams.get('create') === '1';
  const createPriorityParam = searchParams.get('priority');
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [dueDateRange, setDueDateRange] = useState<TaskDueDateRange>({ from: '', to: '' });
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileStatusMenu, setShowMobileStatusMenu] = useState(false);
  const mobileStatusMenuRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>(activeProjectId);
  const [createPriority, setCreatePriority] = useState<TaskPriority>('No priority');
  const [sortBy, setSortBy] = useState<TaskSortValue>('due_date');
  const [sortAscending, setSortAscending] = useState(true);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [activeProjectId, searchQuery, targetTaskId]);

  useEffect(() => {
    if (searchQuery) setActiveFilter('All');
  }, [searchQuery]);

  useEffect(() => {
    if (targetTaskId) setActiveFilter('All');
  }, [targetTaskId]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('mobile-task-selection-change', { detail: selected.length > 0 }),
    );
  }, [selected.length]);

  useEffect(
    () => () => {
      window.dispatchEvent(new CustomEvent('mobile-task-selection-change', { detail: false }));
    },
    [],
  );

  useEffect(() => {
    setCreateProjectId(activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    if (!showMobileStatusMenu) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!mobileStatusMenuRef.current?.contains(event.target as Node)) {
        setShowMobileStatusMenu(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowMobileStatusMenu(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showMobileStatusMenu]);

  useEffect(() => {
    function toggleMobileFilters() {
      setShowMobileFilters((current) => !current);
    }

    window.addEventListener('toggle-mobile-task-filters', toggleMobileFilters);
    return () => window.removeEventListener('toggle-mobile-task-filters', toggleMobileFilters);
  }, []);

  useEffect(() => {
    if (!showMobileFilters) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowMobileFilters(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showMobileFilters]);

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
        event as CustomEvent<{
          projectId?: string | null;
          priority?: TaskPriorityValue | null;
        }>
      ).detail;
      setCreateProjectId(detail?.projectId || activeProjectId || '');
      if (detail?.priority) {
        setCreatePriority(priorityFromApi(detail.priority));
      } else {
        setCreatePriority('No priority');
      }
      setIsModalOpen(true);
    }

    function closeTourTaskForm() {
      setIsModalOpen(false);
    }
    window.addEventListener('open-create-task', handleOpenCreateTask);
    window.addEventListener('chrono:close-tour-task-form', closeTourTaskForm);
    return () => {
      window.removeEventListener('open-create-task', handleOpenCreateTask);
      window.removeEventListener('chrono:close-tour-task-form', closeTourTaskForm);
    };
  }, [activeProjectId]);

  const {
    tasks,
    setTasks,
    projects,
    counts,
    totalPages,
    totalTasks,
    isLoading,
    refreshTasks,
    refreshCounts,
  } = useTaskPageData({
    activeProjectId,
    searchQuery,
    targetTaskId,
    activeFilter,
    priorityFilter,
    dueFrom: dueDateRange.from ? new Date(`${dueDateRange.from}T00:00:00`).toISOString() : undefined,
    dueTo: dueDateRange.to ? new Date(`${dueDateRange.to}T23:59:59.999`).toISOString() : undefined,
    sortBy,
    sortAscending,
    page,
    pageSize,
    allTasks: isMobile === true,
    enabled: isMobile !== null,
    setError,
    setSelected,
    setMenuTaskId,
  });

  const {
    isMutating,
    isMoveOpen,
    setIsMoveOpen,
    rescheduleTaskId,
    setRescheduleTaskId,
    rescheduleDueDate,
    setRescheduleDueDate,
    toggleSubtask,
    changeStatus,
    completeSelected,
    deleteSelected,
    moveSelected,
    handleDuplicate,
    toggleScheduleLock,
    handleDeleteOne,
    handleReschedule,
    openReschedule,
    addTask,
    editTask,
    deleteEditingTask,
  } = useTaskPageActions({
    tasks,
    setTasks,
    selected,
    page: isMobile ? 1 : page,
    editingTask,
    setEditingTask,
    setPage,
    setError,
    setMenuTaskId,
    setIsModalOpen,
    refreshTasks,
    refreshCounts,
  });

  const visibleTasks = tasks;
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const mobileTaskGroups = (['Overdue', 'Today', 'Upcoming', 'Other'] as const)
    .map((group) => ({
      group,
      tasks: visibleTasks.filter((task) => mobileGroupForTask(task) === group),
    }))
    .filter((item) => item.tasks.length > 0);

  const allVisibleSelected =
    visibleTasks.length > 0 && visibleTasks.every((task) => selected.includes(task.id));
  const visibleTotal = targetTaskId ? visibleTasks.length : totalTasks;
  const visibleStart = visibleTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleEnd = targetTaskId ? visibleTasks.length : Math.min(page * pageSize, visibleTotal);
  const pageNumbers = Array.from(
    new Set([1, page - 1, page, page + 1, totalPages].filter((number) => number >= 1 && number <= totalPages)),
  ).sort((first, second) => first - second);

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id],
    );
  }

  function toggleTaskExpanded(id: string) {
    setExpandedTaskIds((current) =>
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

  const mobileStatusFilter = (
    <div className="relative" ref={mobileStatusMenuRef}>
      <button
        aria-controls="mobile-task-status-options"
        aria-expanded={showMobileStatusMenu}
        aria-haspopup="menu"
        className="flex h-10 min-w-20 items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 text-sm font-medium text-slate-500 transition-colors hover:text-dashboard-text"
        onClick={() => setShowMobileStatusMenu((open) => !open)}
        type="button"
      >
        {activeFilter === 'All' ? 'All tasks' : activeFilter}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn('h-4 w-4 transition-transform', showMobileStatusMenu && 'rotate-180')}
        />
      </button>
      {showMobileStatusMenu ? (
        <div
          aria-label="Filter tasks by status"
          className="absolute right-0 top-full z-50 mt-2 min-w-44 overflow-hidden rounded-[var(--radius-md)] border border-dashboard-border-strong bg-dashboard-raised p-1.5 shadow-panel"
          id="mobile-task-status-options"
          role="menu"
        >
          {mobileFilterOrder.map((filter) => (
            <button
              aria-checked={activeFilter === filter}
              className={cn(
                'flex h-10 w-full items-center rounded-[var(--radius-sm)] px-3 text-left text-sm font-medium transition',
                activeFilter === filter
                  ? 'bg-dashboard-accent-soft text-dashboard-accent'
                  : 'text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-text',
              )}
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setPage(1);
                setShowMobileStatusMenu(false);
              }}
              role="menuitemradio"
              type="button"
            >
              {filter === 'All' ? 'All tasks' : filter}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={selected.length ? 'pb-20 lg:pb-0' : undefined}>
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
            style={{
              backgroundColor: activeProject?.color ?? 'var(--dashboard-muted)',
            }}
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

      <section aria-label="Mobile task controls" className="mb-6 lg:hidden">
        <SearchBox compact showFilterButton />
      </section>

      {dueDateRange.from || dueDateRange.to ? (
        <section
          aria-label="Active due date filter"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-surface/55 px-4 py-3"
        >
          <p className="text-sm text-dashboard-muted">
            Due date:{' '}
            <span className="font-medium text-dashboard-text">
              {dueDateRange.from || 'Any date'} – {dueDateRange.to || 'Any date'}
            </span>
          </p>
          <button
            className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-dashboard-muted hover:text-dashboard-accent"
            onClick={() => {
              setDueDateRange({ from: '', to: '' });
              setPage(1);
            }}
            type="button"
          >
            Clear
          </button>
        </section>
      ) : null}

      {selected.length ? (
        <div
          aria-live="polite"
          className="mb-4 flex items-center justify-between border-b border-dashboard-border py-2 lg:hidden"
        >
          <span className="text-sm font-medium text-dashboard-text">
            {selected.length} selected
          </span>
          <button
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-dashboard-muted transition-colors hover:text-dashboard-text"
            disabled={isMutating}
            onClick={() => setSelected([])}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {showMobileFilters ? (
        <div
          aria-labelledby="mobile-task-filter-title"
          aria-modal="true"
          className="fixed inset-0 z-[260] grid place-items-end bg-dashboard-overlay-soft p-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setShowMobileFilters(false);
          }}
          role="dialog"
        >
          <section className="mx-auto max-h-[calc(100dvh-8rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-dashboard-border-strong bg-dashboard-raised p-5 shadow-panel">
            <header className="flex items-center justify-between gap-4 border-b border-dashboard-border pb-4">
              <div>
                <h2
                  className="font-poppins text-xl font-semibold text-dashboard-text"
                  id="mobile-task-filter-title"
                >
                  Filter &amp; sort
                </h2>
                <p className="mt-1 text-xs text-dashboard-muted">Refine the tasks shown below.</p>
              </div>
              <button
                aria-label="Close filters"
                className="grid h-10 w-10 place-items-center rounded-full text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-text"
                onClick={() => setShowMobileFilters(false)}
                type="button"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </header>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-dashboard-text">Priority</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {priorityFilters.map((option) => (
                  <button
                    aria-pressed={priorityFilter === option}
                    className={cn(
                      'flex h-11 items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition',
                      option === 'All' && 'col-span-2',
                      priorityFilter === option
                        ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                        : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted',
                    )}
                    key={option}
                    onClick={() => {
                      setPriorityFilter(option);
                      setPage(1);
                    }}
                    type="button"
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        option === 'All' && 'bg-dashboard-muted',
                        option === 'No priority' && 'border border-dashboard-muted',
                        option === 'Low' && 'bg-[var(--blue)]',
                        option === 'Medium' && 'bg-[var(--yellow-fill)]',
                        option === 'High' && 'bg-[var(--red)]',
                      )}
                    />
                    {option === 'All' ? 'All priorities' : option}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-semibold text-dashboard-text">Sort by</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {sortOptions.map((option) => (
                  <button
                    aria-pressed={sortBy === option.value}
                    className={cn(
                      'h-10 rounded-[var(--radius-sm)] border px-3 text-sm font-medium transition',
                      sortBy === option.value
                        ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                        : 'border-dashboard-border bg-[var(--bg-input)] text-dashboard-muted',
                    )}
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setPage(1);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-5">
              <p className="text-sm font-semibold text-dashboard-text">Order</p>
              <div className="mt-3 grid grid-cols-2 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] p-1">
                {(
                  [
                    { label: 'Ascending', value: true },
                    { label: 'Descending', value: false },
                  ] as const
                ).map((option) => (
                  <button
                    aria-pressed={sortAscending === option.value}
                    className={cn(
                      'flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition',
                      sortAscending === option.value
                        ? 'bg-dashboard-accent-soft text-dashboard-accent'
                        : 'text-dashboard-muted',
                    )}
                    key={option.label}
                    onClick={() => {
                      setSortAscending(option.value);
                      setPage(1);
                    }}
                    type="button"
                  >
                    <SortIcon className={cn('h-4 w-4', !option.value && 'rotate-180')} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <footer className="mt-6 grid grid-cols-2 gap-3 border-t border-dashboard-border pt-5">
              <button
                className="h-11 rounded-[var(--radius-sm)] border border-dashboard-border-strong text-sm font-semibold text-dashboard-muted transition hover:text-dashboard-text"
                onClick={() => {
                  setPriorityFilter('All');
                  setSortBy('due_date');
                  setSortAscending(true);
                  setPage(1);
                }}
                type="button"
              >
                Reset
              </button>
              <button
                className="h-11 rounded-[var(--radius-sm)] bg-dashboard-accent text-sm font-semibold text-dashboard-on-accent shadow-glow transition hover:brightness-110"
                onClick={() => setShowMobileFilters(false)}
                type="button"
              >
                Show results
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <section
        aria-label="Task controls"
        className="mb-5 hidden flex-nowrap items-center gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex"
        tabIndex={0}
      >
        <div className="flex max-w-full shrink-0 gap-2 overflow-x-auto">
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

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-3">
          <TaskFilterMenu
            projects={projects}
            value={{
              projectId: activeProjectId,
              status: activeFilter,
              priority: priorityFilter,
              dueDate: dueDateRange,
            }}
            onApply={(filters) => {
              setActiveFilter(filters.status);
              setPriorityFilter(filters.priority);
              setDueDateRange(filters.dueDate);
              setPage(1);
              const params = new URLSearchParams(searchParams);
              if (filters.projectId) params.set('project_id', filters.projectId);
              else params.delete('project_id');
              params.delete('task_id');
              if (params.toString() !== searchParams.toString()) {
                const query = params.toString();
                router.push(query ? `/tasks?${query}` : '/tasks', { scroll: false });
              }
            }}
          />

          <button
            className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-dashboard-on-accent shadow-glow transition hover:brightness-110"
            data-tour="task-create-page"
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

      <TaskMobileList
        key={JSON.stringify([activeProjectId, searchQuery, targetTaskId, activeFilter, priorityFilter, dueDateRange.from, dueDateRange.to, sortBy, sortAscending])}
        mobileTaskGroups={mobileTaskGroups}
        mobileStatusFilter={mobileStatusFilter}
        selected={selected}
        expandedTaskIds={expandedTaskIds}
        isLoading={isLoading}
        isMutating={isMutating}
        changeStatus={changeStatus}
        toggleSelected={toggleSelected}
        toggleTaskExpanded={toggleTaskExpanded}
        setEditingTask={setEditingTask}
        toggleSubtask={toggleSubtask}
      />

      <TaskDesktopTable
        sortBy={sortBy}
        sortAscending={sortAscending}
        onSort={(column) => {
          const next = nextTaskSort(sortBy, sortAscending, column);
          setSortBy(next.sortBy);
          setSortAscending(next.sortAscending);
          setPage(1);
        }}
        visibleTasks={visibleTasks}
        selected={selected}
        expandedTaskIds={expandedTaskIds}
        targetTaskId={targetTaskId}
        menuTaskId={menuTaskId}
        allVisibleSelected={allVisibleSelected}
        isLoading={isLoading}
        isMutating={isMutating}
        toggleAllVisible={toggleAllVisible}
        toggleSelected={toggleSelected}
        toggleTaskExpanded={toggleTaskExpanded}
        setEditingTask={setEditingTask}
        setMenuTaskId={setMenuTaskId}
        changeStatus={changeStatus}
        handleDuplicate={handleDuplicate}
        openReschedule={openReschedule}
        toggleScheduleLock={toggleScheduleLock}
        handleDeleteOne={handleDeleteOne}
        toggleSubtask={toggleSubtask}
      />

      <footer className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center">
        {selected.length ? (
        <div className="hidden min-h-12 flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-dashboard-border bg-dashboard-surface/70 p-2 lg:flex">
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
          <button
            className="h-9 rounded-lg px-3 text-sm text-dashboard-muted transition hover:text-dashboard-text disabled:opacity-40"
            disabled={isMutating}
            onClick={() => setSelected([])}
            type="button"
          >
            Cancel
          </button>
        </div>
        ) : null}

        <div className="ml-auto hidden flex-wrap items-center justify-end gap-3 text-sm text-dashboard-muted lg:flex">
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
            {pageNumbers.map((pageNumber, index) => (
              <span className="contents" key={pageNumber}>
                {index > 0 && pageNumber - pageNumbers[index - 1] > 1 ? (
                  <span aria-hidden="true" className="w-6 text-center text-dashboard-subtle">
                    …
                  </span>
                ) : null}
                <button
                  aria-current={pageNumber === page ? 'page' : undefined}
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-lg border text-sm transition',
                    pageNumber === page
                      ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                      : 'border-dashboard-border bg-dashboard-surface text-dashboard-muted hover:text-dashboard-text',
                  )}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              </span>
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
          onDelete={deleteEditingTask}
          onUpdate={editTask}
          projects={projects}
          task={editingTask}
        />
      ) : null}

      {isMoveOpen ? (
        <div
          aria-labelledby="move-tasks-title"
          aria-modal="true"
          className="fixed inset-0 z-[300] grid place-items-center bg-dashboard-overlay p-4 backdrop-blur-[5px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsMoveOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-modal">
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
          className="fixed inset-0 z-[300] grid place-items-center bg-dashboard-overlay p-4 backdrop-blur-[5px]"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setRescheduleTaskId(null);
              setRescheduleDueDate('');
            }
          }}
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-modal">
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
                className="h-10 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-dashboard-on-accent"
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
      <div
        aria-hidden={selected.length === 0}
        className={`fixed inset-x-0 bottom-[calc(0.7rem+env(safe-area-inset-bottom))] z-[195] px-6 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none lg:hidden ${selected.length ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
        inert={selected.length === 0}
      >
          <div
            aria-label="Actions for selected tasks"
            className="flex items-center rounded-2xl border border-dashboard-border-strong bg-dashboard-raised p-2 shadow-panel"
          >
            <button
              aria-label="Delete selected tasks"
              className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--red)] px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isMutating}
              onClick={() => void deleteSelected()}
              type="button"
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
      </div>
    </div>
  );
}
