'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRightIcon, PlusIcon } from '../layout/icons';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listProjects, type Project } from '../../lib/projects';
import {
  createTask,
  listTasks,
  rescheduleTask,
  updateTask,
  type TaskCreateInput,
  type TaskStatusValue,
} from '../../lib/tasks';
import { CreateTaskModal } from '../tasks/create-task-modal';

import {
  addDays,
  buildDay,
  buildMonthDays,
  buildWeekDays,
  cn,
  dateKey,
  formatMonthTitle,
  formatSelectedDate,
  formatWeekTitle,
  groupTasks,
  toCalendarTask,
  weekdayLabels,
  type CalendarTask,
  type CalendarView,
} from './calendar-model';
import {
  CalendarMainView,
  DayAgenda,
  MobileCalendarView,
  RescheduleDialog,
} from './calendar-views';

export type { CalendarTask, CalendarTaskPriority, CalendarTaskStatus } from './calendar-model';

export function CalendarPage() {
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showCompleted, setShowCompleted] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutatingTaskId, setMutatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarTask | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const days = useMemo(() => {
    if (calendarView === 'week') return buildWeekDays(selectedDate);
    if (calendarView === 'day') return buildDay(selectedDate);
    return buildMonthDays(visibleMonth);
  }, [calendarView, selectedDate, visibleMonth]);
  const mobileMonthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);

  const visibleRange = useMemo(() => {
    const start = new Date(days[0].date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(days.at(-1)?.date ?? days[0].date);
    end.setHours(23, 59, 59, 999);

    return {
      dueFrom: start.toISOString(),
      dueTo: end.toISOString(),
    };
  }, [days]);

  const refreshCalendarTasks = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoadError(null);
        setIsLoading(true);

        const firstPage = await listTasks(
          {
            page: 1,
            pageSize: 100,
            sortBy: 'due_date',
            sortOrder: 'asc',
          },
          { signal },
        );

        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(firstPage.total_pages - 1, 0) }, (_, index) =>
            listTasks(
              {
                page: index + 2,
                pageSize: 100,
                sortBy: 'due_date',
                sortOrder: 'asc',
              },
              { signal },
            ),
          ),
        );
        const rangeStart = new Date(visibleRange.dueFrom).getTime();
        const rangeEnd = new Date(visibleRange.dueTo).getTime();
        const items = [firstPage, ...remainingPages].flatMap((page) => page.items);

        setCalendarTasks(
          items
            .map(toCalendarTask)
            .filter((task): task is CalendarTask => task !== null)
            .filter((task) => {
              const timestamp = new Date(task.calendarDate).getTime();
              return timestamp >= rangeStart && timestamp <= rangeEnd;
            }),
        );
      } catch (error) {
        if (signal?.aborted) return;

        setLoadError(error instanceof Error ? error.message : 'Unable to load calendar tasks.');
        setCalendarTasks([]);
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [visibleRange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refreshCalendarTasks(controller.signal);
    return () => controller.abort();
  }, [refreshCalendarTasks]);

  useEffect(
    () =>
      onTaskDataChanged(() => {
        void refreshCalendarTasks();
      }),
    [refreshCalendarTasks],
  );

  useEffect(
    () =>
      onProjectDataChanged(() => {
        void refreshCalendarTasks();
      }),
    [refreshCalendarTasks],
  );

  async function openCreateTaskModal() {
    setActionError(null);
    setIsCreateTaskOpen(true);
    try {
      setProjects(await listProjects());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to load folders.');
    }
  }

  async function createCalendarTask(input: TaskCreateInput) {
    setIsCreatingTask(true);
    setActionError(null);
    try {
      await createTask(input);
      setIsCreateTaskOpen(false);
      await refreshCalendarTasks();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to create task.');
      throw error;
    } finally {
      setIsCreatingTask(false);
    }
  }

  const visibleTasks = useMemo(
    () =>
      calendarTasks
        .filter((task) => showCompleted || task.status !== 'done')
        .sort(
          (first, second) =>
            new Date(first.calendarDate).getTime() - new Date(second.calendarDate).getTime(),
        ),
    [calendarTasks, showCompleted],
  );
  const tasksByDay = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);
  const mobileTasksByDay = useMemo(() => groupTasks(calendarTasks), [calendarTasks]);
  const selectedKey = dateKey(selectedDate);
  const selectedTasks = tasksByDay[selectedKey] ?? [];
  const mobileSelectedTasks = mobileTasksByDay[selectedKey] ?? [];
  const calendarTitle =
    calendarView === 'month'
      ? formatMonthTitle(visibleMonth)
      : calendarView === 'week'
        ? formatWeekTitle(days)
        : formatSelectedDate(selectedDate);

  function moveCalendar(delta: number) {
    if (calendarView === 'month') {
      setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
      return;
    }

    const dayDelta = calendarView === 'week' ? delta * 7 : delta;

    setSelectedDate((current) => {
      const next = addDays(current, dayDelta);
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
      return next;
    });
  }

  function moveSelectedDate(delta: number) {
    setSelectedDate((current) => {
      const next = addDays(current, delta);
      setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
      return next;
    });
  }

  function moveMobileMonth(delta: number) {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      setSelectedDate(next);
      return next;
    });
  }

  function goToToday() {
    const today = new Date();
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  async function toggleTaskStatus(task: CalendarTask) {
    const nextStatus: TaskStatusValue = task.status === 'done' ? 'pending' : 'done';

    setActionError(null);
    setMutatingTaskId(task.id);

    try {
      await updateTask(task.id, { status: nextStatus });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update calendar task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  async function moveTaskToDate(taskId: string, date: Date) {
    const task = calendarTasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    if (task.scheduleLocked) {
      setActionError('Unlock this task before changing its schedule.');
      return;
    }

    const currentDate = new Date(task.calendarDate);
    const nextDate = new Date(date);
    nextDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);
    const payload =
      task.scheduledStart && task.scheduledEnd
        ? {
            scheduled_start: nextDate.toISOString(),
            scheduled_end: new Date(
              nextDate.getTime() +
                new Date(task.scheduledEnd).getTime() -
                new Date(task.scheduledStart).getTime(),
            ).toISOString(),
          }
        : { due_date: nextDate.toISOString() };

    setActionError(null);
    setMutatingTaskId(task.id);
    try {
      const updated = await rescheduleTask(task.id, payload);
      const nextTask = toCalendarTask(updated);
      setCalendarTasks((current) =>
        nextTask ? current.map((item) => (item.id === task.id ? nextTask : item)) : current,
      );
      selectDate(date);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reschedule task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  function openRescheduleDialog(task: CalendarTask) {
    if (task.scheduleLocked) {
      setActionError('Unlock this task before changing its schedule.');
      return;
    }
    const currentDate = new Date(task.calendarDate);
    setRescheduleTarget(task);
    setRescheduleDate(dateKey(currentDate));
    setRescheduleTime(
      `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`,
    );
    setActionError(null);
  }

  async function submitReschedule() {
    if (!rescheduleTarget || !rescheduleDate) return;

    const nextDate = new Date(
      `${rescheduleDate}T${rescheduleTime ? `${rescheduleTime}:00` : '23:59:00'}`,
    );
    if (Number.isNaN(nextDate.getTime())) {
      setActionError('Choose a valid date and time.');
      return;
    }

    setActionError(null);
    setMutatingTaskId(rescheduleTarget.id);
    try {
      const payload =
        rescheduleTarget.scheduledStart && rescheduleTarget.scheduledEnd
          ? {
              scheduled_start: nextDate.toISOString(),
              scheduled_end: new Date(
                nextDate.getTime() +
                  new Date(rescheduleTarget.scheduledEnd).getTime() -
                  new Date(rescheduleTarget.scheduledStart).getTime(),
              ).toISOString(),
            }
          : { due_date: nextDate.toISOString() };
      const updated = await rescheduleTask(rescheduleTarget.id, payload);
      const nextTask = toCalendarTask(updated);
      setCalendarTasks((current) =>
        nextTask
          ? current.map((item) => (item.id === rescheduleTarget.id ? nextTask : item))
          : current,
      );
      selectDate(nextDate);
      setRescheduleTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reschedule task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  function selectCalendarView(nextView: CalendarView) {
    setCalendarView(nextView);

    if (nextView !== 'month') {
      setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  return (
    <>
      <MobileCalendarView
        days={mobileMonthDays}
        isLoading={isLoading}
        loadError={loadError}
        mutatingTaskId={mutatingTaskId}
        onMoveMonth={moveMobileMonth}
        onReschedule={openRescheduleDialog}
        onSelectDate={selectDate}
        onToggleTask={toggleTaskStatus}
        selectedDate={selectedDate}
        selectedKey={selectedKey}
        selectedTasks={mobileSelectedTasks}
        tasksByDay={mobileTasksByDay}
        visibleMonth={visibleMonth}
      />

      <section className="hidden gap-5 lg:grid xl:grid-cols-[minmax(0,1.75fr)_minmax(380px,0.9fr)]">
        <div className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-dashboard-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                aria-label={`Previous ${calendarView}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
                onClick={() => moveCalendar(-1)}
                type="button"
              >
                <ChevronRightIcon className="h-4 w-4 rotate-180" />
              </button>
              <button
                aria-label={`Next ${calendarView}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
                onClick={() => moveCalendar(1)}
                type="button"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
              <h2 className="truncate text-xl font-semibold text-dashboard-text">
                {calendarTitle}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-dashboard-border bg-dashboard-bg/45 p-1">
                {(
                  [
                    ['month', 'Month'],
                    ['week', 'Week'],
                    ['day', 'Day'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    aria-pressed={calendarView === value}
                    className={cn(
                      'h-9 rounded-md px-3 text-sm font-medium transition',
                      calendarView === value
                        ? 'bg-dashboard-accent-soft text-dashboard-accent ring-1 ring-dashboard-accent/40'
                        : 'text-dashboard-muted hover:text-dashboard-text',
                    )}
                    key={value}
                    onClick={() => selectCalendarView(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                className="flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-4 text-sm font-semibold text-[#04110d] shadow-glow transition hover:brightness-110"
                onClick={() => void openCreateTaskModal()}
                type="button"
              >
                <PlusIcon className="h-4 w-4" />
                New Event
              </button>
            </div>
          </div>

          {loadError ? (
            <p
              className="m-4 rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger sm:m-5"
              role="alert"
            >
              {loadError}
            </p>
          ) : null}

          {calendarView !== 'day' ? (
            <div className="grid grid-cols-7 border-b border-dashboard-border bg-dashboard-bg/20">
              {weekdayLabels.map((label) => (
                <div
                  className="border-r border-dashboard-border px-3 py-3 text-sm font-semibold text-dashboard-muted last:border-r-0"
                  key={label}
                >
                  {label}
                </div>
              ))}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid min-h-[360px] place-items-center text-sm text-dashboard-muted">
              Loading calendar tasks...
            </div>
          ) : (
            <CalendarMainView
              calendarView={calendarView}
              days={days}
              mutatingTaskId={mutatingTaskId}
              onDropTask={moveTaskToDate}
              onReschedule={openRescheduleDialog}
              onSelectDate={selectDate}
              onToggleTask={toggleTaskStatus}
              selectedKey={selectedKey}
              tasksByDay={tasksByDay}
            />
          )}
        </div>

        <DayAgenda
          actionError={actionError}
          mutatingTaskId={mutatingTaskId}
          onNextDay={() => moveSelectedDate(1)}
          onPreviousDay={() => moveSelectedDate(-1)}
          onReschedule={openRescheduleDialog}
          onShowCompletedChange={() => setShowCompleted((current) => !current)}
          onToday={goToToday}
          onToggleTask={toggleTaskStatus}
          selectedDate={selectedDate}
          showCompleted={showCompleted}
          tasks={selectedTasks}
        />
      </section>
      {rescheduleTarget ? (
        <RescheduleDialog
          date={rescheduleDate}
          error={actionError}
          isSubmitting={mutatingTaskId === rescheduleTarget.id}
          onClose={() => setRescheduleTarget(null)}
          onDateChange={setRescheduleDate}
          onSubmit={() => void submitReschedule()}
          onTimeChange={setRescheduleTime}
          task={rescheduleTarget}
          time={rescheduleTime}
        />
      ) : null}
      {isCreateTaskOpen ? (
        <CreateTaskModal
          isSubmitting={isCreatingTask}
          onClose={() => setIsCreateTaskOpen(false)}
          onCreate={createCalendarTask}
          projects={projects}
        />
      ) : null}
    </>
  );
}
