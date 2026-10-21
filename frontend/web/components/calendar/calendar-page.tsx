'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRightIcon, PlusIcon } from '../layout/icons';
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
  weekdayLabels,
  type CalendarView,
} from './calendar-model';
import { getTask } from '../../lib/tasks';
import {
  CalendarMainView,
  DayAgenda,
  MobileCalendarView,
  RescheduleDialog,
} from './calendar-views';

import { useCalendarTasks } from './use-calendar-tasks';

export type { CalendarTask, CalendarTaskPriority, CalendarTaskStatus } from './calendar-model';

export function CalendarPage() {
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateValue = params.get('date');
    const taskId = params.get('taskId');

    if (dateValue) {
      const date = new Date(dateValue);
      if (!Number.isNaN(date.getTime())) {
        setCalendarView('day');
        setSelectedDate(date);
        setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    }

    if (!taskId) return;

    const controller = new AbortController();
    void getTask(taskId, { signal: controller.signal })
      .then((task) => {
        const calendarDate = task.scheduled_start ?? task.due_date;
        if (!calendarDate) return;

        const date = new Date(calendarDate);
        if (Number.isNaN(date.getTime())) return;

        setCalendarView('day');
        setSelectedDate(date);
        setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      })
      .catch(() => {
        // The due-date fallback still opens the relevant calendar day.
      });

    return () => controller.abort();
  }, []);

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

  const {
    calendarTasks,
    isLoading,
    loadError,
    mutatingTaskId,
    actionError,
    rescheduleTarget,
    setRescheduleTarget,
    rescheduleDate,
    setRescheduleDate,
    rescheduleTime,
    setRescheduleTime,
    projects,
    isCreateTaskOpen,
    setIsCreateTaskOpen,
    isCreatingTask,
    openCreateTaskModal,
    createCalendarTask,
    toggleTaskStatus,
    moveTaskToDate,
    openRescheduleDialog,
    submitReschedule,
  } = useCalendarTasks({ visibleRange, selectDate });

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
                className="flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-dashboard-accent to-dashboard-accent-strong px-4 text-sm font-semibold text-dashboard-on-accent shadow-glow transition hover:brightness-110"
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
