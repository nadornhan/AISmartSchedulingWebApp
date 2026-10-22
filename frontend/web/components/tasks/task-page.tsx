'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type TaskPriorityValue, type TaskResponse, type TaskSortValue } from '../../lib/tasks';
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

import { TaskDesktopTable, TaskMobileList } from './task-list-views';
import { useTaskPageData } from './use-task-page-data';
import { useTaskPageActions } from './use-task-page-actions';
import {
  cn,
  filterOrder,
  mobileFilterOrder,
  mobileGroupForTask,
  priorityFilters,
  priorityFromApi,
  sortOptions,
  type PriorityFilter,
  type TaskFilter,
  type TaskPriority,
} from './task-page-model';

export function TaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get('project_id') || '';
  const searchQuery = searchParams.get('search')?.trim() || '';
  const targetTaskId = searchParams.get('task_id') || '';
  const pageSize = 8;
  const shouldOpenCreate = searchParams.get('create') === '1';
  const createPriorityParam = searchParams.get('priority');
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
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
    if (searchQuery || targetTaskId) {
      setActiveFilter('All');
    }
  }, [activeProjectId, searchQuery, targetTaskId]);

  useEffect(() => {
    setCreateProjectId(activeProjectId);
  }, [activeProjectId]);

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

    window.addEventListener('open-create-task', handleOpenCreateTask);
    return () => window.removeEventListener('open-create-task', handleOpenCreateTask);
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
    sortBy,
    sortAscending,
    page,
    pageSize,
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
    page,
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
        <div className="accent-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-2">
          {mobileFilterOrder.map((filter) => (
            <button
              aria-pressed={activeFilter === filter}
              className={cn(
                'h-10 shrink-0 rounded-[var(--radius-sm)] border px-5 text-sm font-medium transition',
                activeFilter === filter
                  ? 'border-dashboard-accent bg-dashboard-accent-soft text-dashboard-accent'
                  : 'border-transparent bg-dashboard-raised text-dashboard-muted',
              )}
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setPage(1);
              }}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

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

          <TaskSortMenu value={sortBy} onChange={setSortBy} />

          <button
            aria-label={sortAscending ? 'Sort ascending' : 'Sort descending'}
            className="grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text"
            onClick={() => setSortAscending((current) => !current)}
            type="button"
          >
            <ChevronDownIcon className={cn('h-4 w-4 transition', !sortAscending && 'rotate-180')} />
          </button>

          <button
            className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-5 text-sm font-semibold text-dashboard-on-accent shadow-glow transition hover:brightness-110"
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
        mobileTaskGroups={mobileTaskGroups}
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

      {totalPages > 1 ? (
        <footer className="mt-6 flex items-center justify-between gap-3 text-sm text-dashboard-muted lg:hidden">
          <button
            className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface px-4 disabled:opacity-40"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface px-4 disabled:opacity-40"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            Next
          </button>
        </footer>
      ) : null}

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
    </>
  );
}

function TaskSortMenu({ value, onChange }: {
  value: TaskSortValue;
  onChange: (value: TaskSortValue) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 184);
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
      });
    };
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const closeMenu = () => setIsOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    updatePosition();
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [isOpen]);

  const selectedLabel = sortOptions.find((option) => option.value === value)?.label ?? 'Due date';

  return (
    <>
      <button
        aria-controls="task-sort-menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Sort tasks: ${selectedLabel}`}
        className="flex h-11 shrink-0 items-center gap-3 rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface px-4 text-sm font-medium text-dashboard-muted outline-none transition hover:border-dashboard-border-strong hover:text-dashboard-text focus-visible:border-dashboard-accent focus-visible:ring-2 focus-visible:ring-dashboard-accent/20"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <SortIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{selectedLabel}</span>
        <ChevronDownIcon aria-hidden="true" className={`h-4 w-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && position ? createPortal(
        <div
          className="fixed z-[220] overflow-hidden rounded-xl border border-dashboard-border-strong bg-dashboard-raised p-1.5 shadow-panel"
          id="task-sort-menu"
          ref={menuRef}
          role="menu"
          style={position}
        >
          {sortOptions.map((option) => {
            const selected = value === option.value;
            return (
              <button
                aria-checked={selected}
                className={cn(
                  'flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition',
                  selected
                    ? 'bg-dashboard-accent-soft text-dashboard-accent'
                    : 'text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-text',
                )}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="menuitemradio"
                type="button"
              >
                {option.label}
                {selected ? <CheckIcon aria-hidden="true" className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </>
  );
}
