'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { TaskResponse } from '../../lib/tasks';
import { CalendarIcon, CheckIcon, ChevronDownIcon, ClockIcon, EditIcon, MoreIcon, TasksIcon } from '../layout/icons';
import { CheckBox, StatusDropdown, SubtaskAccordion } from './task-page-controls';
import {
  cn,
  mobileGroupMeta,
  priorityClass,
  type MobileTaskGroup,
  type Task,
  type TaskStatus,
} from './task-page-model';

type TaskDesktopTableProps = {
  visibleTasks: Task[];
  selected: string[];
  expandedTaskIds: string[];
  targetTaskId: string;
  menuTaskId: string | null;
  allVisibleSelected: boolean;
  isLoading: boolean;
  isMutating: boolean;
  toggleAllVisible: () => void;
  toggleSelected: (id: string) => void;
  toggleTaskExpanded: (id: string) => void;
  setEditingTask: Dispatch<SetStateAction<TaskResponse | null>>;
  setMenuTaskId: Dispatch<SetStateAction<string | null>>;
  changeStatus: (id: string, status: TaskStatus) => Promise<void>;
  handleDuplicate: (taskId: string) => Promise<void>;
  openReschedule: (task: Task) => void;
  toggleScheduleLock: (task: Task) => Promise<void>;
  handleDeleteOne: (taskId: string) => Promise<void>;
  toggleSubtask: (task: Task, subtaskId: string, isCompleted: boolean) => Promise<void>;
};

function TaskEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-dashboard-accent/45 bg-dashboard-bg/90 text-dashboard-accent">
        <TasksIcon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <p className="text-base font-semibold text-dashboard-text">No tasks found</p>
        <p className="mt-2 text-sm text-dashboard-muted">
          Try another filter or create a new task.
        </p>
      </div>
    </div>
  );
}

export function TaskDesktopTable({
  visibleTasks,
  selected,
  expandedTaskIds,
  targetTaskId,
  menuTaskId,
  allVisibleSelected,
  isLoading,
  isMutating,
  toggleAllVisible,
  toggleSelected,
  toggleTaskExpanded,
  setEditingTask,
  setMenuTaskId,
  changeStatus,
  handleDuplicate,
  openReschedule,
  toggleScheduleLock,
  handleDeleteOne,
  toggleSubtask,
}: Readonly<TaskDesktopTableProps>) {
  return (
    <section className="hidden rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 shadow-panel lg:block">
      <div className="hidden min-h-16 grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_88px] items-center gap-3 rounded-t-[var(--radius-lg)] border-b border-dashboard-border px-5 text-sm font-semibold uppercase tracking-wide text-dashboard-muted lg:grid 2xl:grid-cols-[36px_minmax(260px,1.6fr)_minmax(110px,0.8fr)_minmax(126px,0.85fr)_minmax(108px,0.75fr)_minmax(128px,0.95fr)_88px]">
        <CheckBox
          checked={allVisibleSelected}
          label="Select all visible tasks"
          onChange={toggleAllVisible}
        />
        <span className="col-span-2 2xl:col-span-1">Task</span>
        <span className="hidden 2xl:block 2xl:text-center">Project</span>
        <span className="hidden 2xl:block 2xl:text-center">Due date</span>
        <span className="hidden 2xl:block 2xl:text-center">Priority</span>
        <span className="hidden 2xl:block 2xl:text-center">Status</span>
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
                'group grid gap-4 bg-[var(--bg-surface)]/45 px-5 py-6 transition hover:bg-[var(--bg-surface-hover)]/65 lg:grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)_88px] lg:items-center lg:gap-3 2xl:grid-cols-[36px_minmax(260px,1.6fr)_minmax(110px,0.8fr)_minmax(126px,0.85fr)_minmax(108px,0.75fr)_minmax(128px,0.95fr)_88px]',
                targetTaskId === task.id &&
                  'bg-dashboard-accent-soft shadow-[inset_3px_0_0_var(--dashboard-accent)]',
                menuTaskId === task.id && 'relative z-30',
                taskIndex === visibleTasks.length - 1 && 'rounded-b-[var(--radius-lg)]',
              )}
              key={task.id}
            >
              <div className="flex items-center gap-3">
                <CheckBox
                  checked={task.workflowStatus === 'Done'}
                  disabled={isMutating}
                  label={`${task.workflowStatus === 'Done' ? 'Reopen' : 'Complete'} ${task.title}`}
                  onChange={() =>
                    void changeStatus(task.id, task.workflowStatus === 'Done' ? 'Pending' : 'Done')
                  }
                />
              </div>

              <button
                aria-expanded={
                  task.source.subtasks.length > 0 ? expandedTaskIds.includes(task.id) : undefined
                }
                className="min-w-0 text-left col-span-2 2xl:col-span-1"
                onClick={() =>
                  task.source.subtasks.length > 0
                    ? toggleTaskExpanded(task.id)
                    : setEditingTask(task.source)
                }
                type="button"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="whitespace-normal break-words text-[17px] font-semibold leading-6 text-dashboard-text">
                      {task.title}
                      {task.overdue ? (
                        <span className="ml-2 inline-flex whitespace-nowrap rounded-full border border-[var(--red-border)] bg-[var(--red-soft)] px-2 py-0.5 align-middle text-[11px] font-semibold leading-4 text-[var(--red-light)]">
                          Overdue
                        </span>
                      ) : null}
                    </h2>
                    {task.subtaskProgressLabel || task.durationLabel ? (
                      <p className="mt-1 text-sm font-medium text-dashboard-muted">
                        {task.subtaskProgressLabel ?? (
                          <span className="inline-flex items-center gap-1.5" aria-label={`Estimated duration: ${task.durationLabel}`}>
                            <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                            {task.durationLabel}
                          </span>
                        )}
                      </p>
                    ) : null}
                    {task.source.schedule_locked ? (
                      <span className="mt-2 inline-flex rounded-[var(--radius-pill)] border border-[var(--purple-border)] bg-[var(--purple-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--purple-light)]">
                        Schedule locked
                      </span>
                    ) : null}
                  </div>
                  {task.source.subtasks.length > 0 ? (
                    <ChevronDownIcon
                      className={cn(
                        'h-5 w-5 shrink-0 text-dashboard-accent transition',
                        !expandedTaskIds.includes(task.id) && '-rotate-90',
                      )}
                    />
                  ) : null}
                </div>
              </button>

              <div className="col-start-2 row-start-2 min-w-0 2xl:col-start-auto 2xl:row-start-auto 2xl:justify-self-center">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dashboard-muted 2xl:hidden">
                  Project
                </span>
                <span
                  className={cn(
                    'inline-flex max-w-full break-words rounded-[var(--radius-pill)] px-3.5 py-2 text-sm font-medium',
                    task.projectId === null && 'bg-[var(--bg-surface-raised)] text-dashboard-muted',
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
                  'col-span-2 col-start-3 row-start-2 min-w-0 text-base text-dashboard-muted 2xl:col-span-1 2xl:col-start-auto 2xl:row-start-auto 2xl:justify-self-center 2xl:text-center',
                  task.overdue && 'font-medium text-[var(--red-light)]',
                )}
              >
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dashboard-muted 2xl:hidden">
                  Due date
                </span>
                {task.dueDate}
              </p>

              <div className="col-start-2 row-start-3 min-w-0 2xl:col-start-auto 2xl:row-start-auto 2xl:justify-self-center">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dashboard-muted 2xl:hidden">
                  Priority
                </span>
                <span
                  className={cn(
                    'inline-flex rounded-[var(--radius-pill)] border px-3.5 py-2 text-sm font-medium',
                    priorityClass(task.priority),
                  )}
                >
                  {task.priority}
                </span>
              </div>

              <div className="col-span-2 col-start-3 row-start-3 space-y-2 2xl:col-span-1 2xl:col-start-auto 2xl:row-start-auto 2xl:justify-self-center">
                <span className="block text-xs font-semibold uppercase tracking-wide text-dashboard-muted 2xl:hidden">
                  Status
                </span>
                <StatusDropdown
                  disabled={isMutating}
                  onChange={(status) => void changeStatus(task.id, status)}
                  taskTitle={task.title}
                  value={task.workflowStatus}
                />
              </div>

              <div className="relative col-start-4 row-start-1 flex justify-end gap-1 text-dashboard-muted 2xl:col-start-auto 2xl:row-start-auto">
                <button
                  aria-label={`Edit ${task.title}`}
                  className="grid h-10 w-10 place-items-center rounded-lg transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                  onClick={() => setEditingTask(task.source)}
                  type="button"
                >
                  <EditIcon className="h-[18px] w-[18px]" />
                </button>
                <button
                  aria-expanded={menuTaskId === task.id}
                  aria-label={`More actions for ${task.title}`}
                  className="grid h-10 w-10 place-items-center rounded-lg transition hover:bg-dashboard-surface hover:text-dashboard-text"
                  onClick={() => setMenuTaskId((current) => (current === task.id ? null : task.id))}
                  type="button"
                >
                  <MoreIcon className="h-[18px] w-[18px]" />
                </button>
                {menuTaskId === task.id ? (
                  <div
                    className={cn(
                      'absolute right-0 z-40 min-w-44 rounded-xl border border-dashboard-border bg-dashboard-raised p-2 shadow-panel',
                      taskIndex >= visibleTasks.length - 2 ? 'bottom-11' : 'top-11',
                    )}
                  >
                    <button
                      className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-dashboard-text transition hover:bg-dashboard-surface hover:text-dashboard-accent"
                      onClick={() => {
                        toggleSelected(task.id);
                        setMenuTaskId(null);
                      }}
                      type="button"
                    >
                      {selected.includes(task.id) ? 'Remove from bulk selection' : 'Select for bulk actions'}
                    </button>
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
                      className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-dashboard-text transition enabled:hover:bg-dashboard-surface enabled:hover:text-dashboard-accent disabled:cursor-not-allowed disabled:text-dashboard-subtle"
                      disabled={
                        !task.source.schedule_locked &&
                        (!task.source.scheduled_start || !task.source.scheduled_end)
                      }
                      onClick={() => void toggleScheduleLock(task)}
                      title={
                        !task.source.schedule_locked &&
                        (!task.source.scheduled_start || !task.source.scheduled_end)
                          ? 'Schedule this task before locking it'
                          : undefined
                      }
                      type="button"
                    >
                      {task.source.schedule_locked ? 'Unlock schedule' : 'Lock schedule'}
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
              {expandedTaskIds.includes(task.id) && task.source.subtasks.length > 0 ? (
                <div className="col-span-full pl-9 2xl:pl-[48px]">
                  <SubtaskAccordion
                    disabled={isMutating}
                    onToggle={(subtaskId, isCompleted) =>
                      void toggleSubtask(task, subtaskId, isCompleted)
                    }
                    task={task}
                  />
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="grid min-h-64 place-items-center rounded-b-[var(--radius-lg)] px-6 text-center">
            <TaskEmptyState />
          </div>
        )}
      </div>
    </section>
  );
}

type TaskMobileListProps = {
  mobileTaskGroups: Array<{ group: MobileTaskGroup; tasks: Task[] }>;
  expandedTaskIds: string[];
  isLoading: boolean;
  isMutating: boolean;
  changeStatus: (id: string, status: TaskStatus) => Promise<void>;
  toggleTaskExpanded: (id: string) => void;
  setEditingTask: Dispatch<SetStateAction<TaskResponse | null>>;
  toggleSubtask: (task: Task, subtaskId: string, isCompleted: boolean) => Promise<void>;
};

export function TaskMobileList({
  mobileTaskGroups,
  expandedTaskIds,
  isLoading,
  isMutating,
  changeStatus,
  toggleTaskExpanded,
  setEditingTask,
  toggleSubtask,
}: Readonly<TaskMobileListProps>) {
  return (
    <section aria-label="Tasks grouped by due date" className="space-y-7 lg:hidden">
      {isLoading ? (
        <div className="grid min-h-56 place-items-center rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 px-6 text-center">
          <div>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dashboard-border border-t-dashboard-accent" />
            <p className="mt-3 text-sm text-dashboard-muted">Loading tasks...</p>
          </div>
        </div>
      ) : mobileTaskGroups.length ? (
        mobileTaskGroups.map(({ group, tasks: groupTasks }) => {
          const meta = mobileGroupMeta[group];
          return (
            <div key={group}>
              <div className={cn('mb-3 flex items-center gap-2', meta.color)}>
                <CalendarIcon className="h-5 w-5" />
                <h2 className="text-sm font-medium text-dashboard-text">{meta.label}</h2>
                <span className="grid min-w-5 place-items-center rounded-full bg-current/10 px-1.5 text-xs font-semibold">
                  {groupTasks.length}
                </span>
              </div>

              <div className="divide-y divide-dashboard-border rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface shadow-panel">
                {groupTasks.map((task) => {
                  const completed = task.workflowStatus === 'Done';
                  return (
                    <article className="px-4 py-3" key={task.id}>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                          className={cn(
                            'grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition',
                            completed
                              ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-on-accent'
                              : 'border-dashboard-border-strong bg-transparent hover:border-dashboard-accent',
                          )}
                          disabled={isMutating}
                          onClick={() => void changeStatus(task.id, completed ? 'Pending' : 'Done')}
                          type="button"
                        >
                          {completed ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                        </button>

                        <button
                          aria-expanded={
                            task.source.subtasks.length > 0
                              ? expandedTaskIds.includes(task.id)
                              : undefined
                          }
                          className="min-w-0 flex-1 text-left"
                          onClick={() =>
                            task.source.subtasks.length > 0
                              ? toggleTaskExpanded(task.id)
                              : setEditingTask(task.source)
                          }
                          type="button"
                        >
                          <span className="flex min-w-0 items-start gap-2 text-base font-semibold text-dashboard-text">
                            <span className="min-w-0 whitespace-normal break-words leading-5">
                              {task.title}
                            </span>
                            {task.source.subtasks.length > 0 ? (
                              <ChevronDownIcon
                                className={cn(
                                  'h-4 w-4 shrink-0 text-dashboard-accent transition',
                                  !expandedTaskIds.includes(task.id) && '-rotate-90',
                                )}
                              />
                            ) : null}
                          </span>
                          <span className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-dashboard-muted">
                            <span className={cn(task.overdue && 'text-[var(--red-light)]')}>◷ {task.dueDate}</span>
                            <span aria-hidden="true">·</span>
                            <span className="flex min-w-0 items-center gap-1.5 truncate">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    task.projectId === null
                                      ? 'var(--dashboard-muted)'
                                      : task.projectColor,
                                }}
                              />
                              <span className="truncate">{task.project}</span>
                            </span>
                          </span>
                        </button>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span
                            className={cn(
                              'inline-flex rounded-[var(--radius-pill)] border px-2.5 py-1 text-[10px] font-medium',
                              priorityClass(task.priority),
                            )}
                          >
                            {task.priority}
                          </span>
                          <button aria-label={`Edit ${task.title}`} className="grid h-8 w-8 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-accent" onClick={() => setEditingTask(task.source)} type="button"><EditIcon className="h-4 w-4" /></button>
                        </div>
                      </div>
                      {expandedTaskIds.includes(task.id) && task.source.subtasks.length > 0 ? (
                        <div className="mt-3 pl-8">
                          <SubtaskAccordion
                            disabled={isMutating}
                            onToggle={(subtaskId, isCompleted) =>
                              void toggleSubtask(task, subtaskId, isCompleted)
                            }
                            task={task}
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : (
        <div className="grid min-h-56 place-items-center rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 px-6 text-center">
          <TaskEmptyState />
        </div>
      )}
    </section>
  );
}
