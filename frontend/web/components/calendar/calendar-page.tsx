'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckIcon, ChevronRightIcon, PlusIcon } from '../layout/icons';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { listTasks, updateTask, type TaskResponse, type TaskStatusValue } from '../../lib/tasks';

export type CalendarTaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type CalendarTaskPriority = 'no_priority' | 'low' | 'medium' | 'high';

export type CalendarTask = {
  id: string;
  title: string;
  project: string;
  projectColor: string;
  dueDate: string;
  durationMinutes: number;
  priority: CalendarTaskPriority;
  status: CalendarTaskStatus;
};

type CalendarView = 'month' | 'week' | 'day';

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildMonthDays(monthDate: Date): CalendarDay[] {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(firstOfMonth, -firstOfMonth.getDay());
  const todayKey = dateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);

    return {
      date,
      key: dateKey(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: dateKey(date) === todayKey,
    };
  });
}

function buildWeekDays(selectedDate: Date): CalendarDay[] {
  const start = addDays(selectedDate, -selectedDate.getDay());
  const todayKey = dateKey(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);

    return {
      date,
      key: dateKey(date),
      isCurrentMonth: true,
      isToday: dateKey(date) === todayKey,
    };
  });
}

function buildDay(selectedDate: Date): CalendarDay[] {
  const todayKey = dateKey(new Date());

  return [
    {
      date: selectedDate,
      key: dateKey(selectedDate),
      isCurrentMonth: true,
      isToday: dateKey(selectedDate) === todayKey,
    },
  ];
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatWeekTitle(days: CalendarDay[]) {
  const start = days[0]?.date ?? new Date();
  const end = days.at(-1)?.date ?? start;

  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'long',
    }).format(start)} - ${new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(end)}`;
  }

  return `${new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(start)} - ${new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(end)}`;
}

function priorityClasses(task: CalendarTask) {
  if (task.status === 'done') {
    return 'border-dashboard-border bg-dashboard-raised/55 text-dashboard-muted';
  }

  if (task.priority === 'high') {
    return 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]';
  }

  if (task.priority === 'medium') {
    return 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]';
  }

  if (task.priority === 'low') {
    return 'border-[var(--blue-border)] bg-[var(--blue-soft)] text-[var(--blue-light)]';
  }

  return 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--green-300)]';
}

function groupTasks(tasks: CalendarTask[]) {
  return tasks.reduce<Record<string, CalendarTask[]>>((groups, task) => {
    const key = dateKey(new Date(task.dueDate));
    groups[key] = [...(groups[key] ?? []), task];
    return groups;
  }, {});
}

function toCalendarTask(task: TaskResponse): CalendarTask | null {
  if (!task.due_date) return null;

  return {
    id: task.id,
    title: task.title,
    project: task.project?.name ?? 'Unassigned',
    projectColor: task.project?.color ?? 'var(--dashboard-muted)',
    dueDate: task.due_date,
    durationMinutes: task.estimated_duration ?? 30,
    priority: task.priority,
    status: task.status,
  };
}

export function CalendarPage() {
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<'all' | 'tasks' | 'focus'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutatingTaskId, setMutatingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const days = useMemo(() => {
    if (calendarView === 'week') return buildWeekDays(selectedDate);
    if (calendarView === 'day') return buildDay(selectedDate);
    return buildMonthDays(visibleMonth);
  }, [calendarView, selectedDate, visibleMonth]);

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

        const response = await listTasks(
          {
            dueFrom: visibleRange.dueFrom,
            dueTo: visibleRange.dueTo,
            page: 1,
            pageSize: 100,
            sortBy: 'due_date',
            sortOrder: 'asc',
          },
          { signal },
        );

        setCalendarTasks(
          response.items.map(toCalendarTask).filter((task): task is CalendarTask => task !== null),
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

  const visibleTasks = useMemo(
    () =>
      calendarTasks
        .filter((task) => showCompleted || task.status !== 'done')
        .sort(
          (first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime(),
        ),
    [calendarTasks, showCompleted],
  );
  const tasksByDay = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);
  const selectedKey = dateKey(selectedDate);
  const selectedTasks = tasksByDay[selectedKey] ?? [];
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
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.95fr)]">
      <div className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 shadow-panel">
        <div className="flex flex-col gap-4 border-b border-dashboard-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
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
            <h2 className="truncate text-xl font-semibold text-dashboard-text">{calendarTitle}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                    'h-9 rounded-md px-4 text-sm font-medium transition',
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
              type="button"
            >
              <PlusIcon className="h-4 w-4" />
              New Event
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-dashboard-border px-4 py-3 sm:px-5">
          {[
            ['all', 'All'],
            ['tasks', 'Tasks'],
            ['focus', 'Focus'],
          ].map(([value, label]) => (
            <button
              aria-pressed={activeFilter === value}
              className={cn(
                'h-9 rounded-lg border px-5 text-sm font-medium transition',
                activeFilter === value
                  ? 'border-dashboard-accent/50 bg-dashboard-accent-soft text-dashboard-accent'
                  : 'border-dashboard-border bg-dashboard-bg/25 text-dashboard-muted hover:border-dashboard-border-strong hover:text-dashboard-text',
                value === 'focus' && 'cursor-not-allowed opacity-50',
              )}
              disabled={value === 'focus'}
              key={value}
              onClick={() => setActiveFilter(value as 'all' | 'tasks' | 'focus')}
              type="button"
            >
              {label}
            </button>
          ))}
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
                className="border-r border-dashboard-border px-3 py-3 text-xs font-semibold text-dashboard-muted last:border-r-0"
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
        onShowCompletedChange={() => setShowCompleted((current) => !current)}
        onToday={goToToday}
        onToggleTask={toggleTaskStatus}
        selectedDate={selectedDate}
        showCompleted={showCompleted}
        tasks={selectedTasks}
      />
    </section>
  );
}

function CalendarMainView({
  calendarView,
  days,
  mutatingTaskId,
  onSelectDate,
  onToggleTask,
  selectedKey,
  tasksByDay,
}: Readonly<{
  calendarView: CalendarView;
  days: CalendarDay[];
  mutatingTaskId: string | null;
  onSelectDate: (date: Date) => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedKey: string;
  tasksByDay: Record<string, CalendarTask[]>;
}>) {
  if (calendarView === 'day') {
    const day = days[0];
    const tasks = tasksByDay[day.key] ?? [];

    return (
      <div className="p-4 sm:p-5">
        <DayTaskPanel
          mutatingTaskId={mutatingTaskId}
          onToggleTask={onToggleTask}
          selectedDate={day.date}
          tasks={tasks}
        />
      </div>
    );
  }

  if (calendarView === 'week') {
    return (
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <CalendarDayCell
            day={day}
            isSelected={day.key === selectedKey}
            key={day.key}
            onSelect={() => onSelectDate(day.date)}
            tasks={tasksByDay[day.key] ?? []}
            variant="week"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7">
      {days.map((day) => (
        <CalendarDayCell
          day={day}
          isSelected={day.key === selectedKey}
          key={day.key}
          onSelect={() => onSelectDate(day.date)}
          tasks={tasksByDay[day.key] ?? []}
        />
      ))}
    </div>
  );
}

function DayTaskPanel({
  mutatingTaskId,
  onToggleTask,
  selectedDate,
  tasks,
}: Readonly<{
  mutatingTaskId: string | null;
  onToggleTask: (task: CalendarTask) => void;
  selectedDate: Date;
  tasks: CalendarTask[];
}>) {
  return (
    <div className="min-h-[420px] rounded-lg border border-dashboard-border bg-dashboard-bg/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-dashboard-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-dashboard-muted">
            Day view
          </p>
          <h3 className="mt-1 text-lg font-semibold text-dashboard-text">
            {formatSelectedDate(selectedDate)}
          </h3>
        </div>
        <span className="rounded-full bg-dashboard-raised px-3 py-1 text-xs font-medium text-dashboard-muted">
          {tasks.length} tasks
        </span>
      </div>

      {tasks.length ? (
        <div className="space-y-4">
          {tasks.map((task) => (
            <AgendaTask
              isMutating={mutatingTaskId === task.id}
              key={task.id}
              onToggleTask={onToggleTask}
              task={task}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-dashboard-border bg-dashboard-bg/20 px-6 text-center">
          <p className="text-sm font-semibold text-dashboard-text">No tasks scheduled</p>
        </div>
      )}
    </div>
  );
}

function CalendarDayCell({
  day,
  isSelected,
  onSelect,
  tasks,
  variant = 'month',
}: Readonly<{
  day: CalendarDay;
  isSelected: boolean;
  onSelect: () => void;
  tasks: CalendarTask[];
  variant?: 'month' | 'week';
}>) {
  return (
    <button
      className={cn(
        'flex h-[118px] flex-col border-r border-t border-dashboard-border bg-dashboard-bg/10 p-3 text-left transition last:border-r-0 hover:bg-dashboard-surface/65 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-dashboard-accent/50',
        variant === 'week' && 'h-[520px]',
        !day.isCurrentMonth && 'bg-dashboard-bg/30 text-dashboard-subtle',
        isSelected &&
          'relative z-10 bg-dashboard-accent-soft ring-2 ring-inset ring-dashboard-accent/70',
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex h-8 shrink-0 items-start justify-between">
        <span
          className={cn(
            'text-sm font-semibold',
            day.isCurrentMonth ? 'text-dashboard-text' : 'text-dashboard-subtle',
            day.isToday &&
              'grid h-7 min-w-7 place-items-center rounded-full bg-dashboard-accent text-dashboard-bg',
          )}
        >
          {day.date.getDate()}
        </span>
      </div>

      <div className="accent-scrollbar mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <CalendarTaskCard compact key={task.id} task={task} />
        ))}
      </div>
    </button>
  );
}

function CalendarTaskCard({
  compact = false,
  task,
}: Readonly<{
  compact?: boolean;
  task: CalendarTask;
}>) {
  return (
    <div
      className={cn(
        'rounded-md border px-2.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.18)]',
        priorityClasses(task),
        task.status === 'done' && 'opacity-70',
      )}
    >
      <p className="truncate text-xs font-semibold leading-4 text-current">{task.title}</p>
      <p
        className={cn('mt-0.5 truncate text-xs font-medium', compact ? 'opacity-85' : 'opacity-75')}
      >
        {formatTime(task.dueDate)}
      </p>
    </div>
  );
}

function DayAgenda({
  actionError,
  mutatingTaskId,
  onNextDay,
  onPreviousDay,
  onShowCompletedChange,
  onToday,
  onToggleTask,
  selectedDate,
  showCompleted,
  tasks,
}: Readonly<{
  actionError: string | null;
  mutatingTaskId: string | null;
  onNextDay: () => void;
  onPreviousDay: () => void;
  onShowCompletedChange: () => void;
  onToday: () => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedDate: Date;
  showCompleted: boolean;
  tasks: CalendarTask[];
}>) {
  return (
    <aside className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 p-5 shadow-panel">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-xl font-semibold text-dashboard-text">
          {formatSelectedDate(selectedDate)}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Previous day"
            className="grid h-9 w-9 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
            onClick={onPreviousDay}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            className="h-9 rounded-lg border border-dashboard-border bg-dashboard-raised px-3 text-sm font-medium text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-text"
            onClick={onToday}
            type="button"
          >
            Today
          </button>
          <button
            aria-label="Next day"
            className="grid h-9 w-9 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
            onClick={onNextDay}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[520px]">
        {actionError ? (
          <p
            className="mb-4 rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger"
            role="alert"
          >
            {actionError}
          </p>
        ) : null}

        {tasks.length ? (
          <>
            <div className="absolute bottom-0 left-[84px] top-0 w-px bg-dashboard-border" />
            <div className="space-y-4">
              {tasks.map((task) => (
                <AgendaTask
                  isMutating={mutatingTaskId === task.id}
                  key={task.id}
                  onToggleTask={onToggleTask}
                  task={task}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-dashboard-border bg-dashboard-bg/20 px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-dashboard-text">No tasks scheduled</p>
            </div>
          </div>
        )}
      </div>

      <label className="mt-5 flex w-fit items-center gap-3 text-sm text-dashboard-muted">
        <button
          aria-pressed={showCompleted}
          className={cn(
            'grid h-5 w-5 place-items-center rounded-[5px] border transition',
            showCompleted
              ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
              : 'border-dashboard-border-strong bg-dashboard-bg hover:border-dashboard-accent/70',
          )}
          onClick={onShowCompletedChange}
          type="button"
        >
          {showCompleted ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        </button>
        Show completed events
      </label>
    </aside>
  );
}

function AgendaTask({
  isMutating,
  onToggleTask,
  task,
}: Readonly<{
  isMutating: boolean;
  onToggleTask: (task: CalendarTask) => void;
  task: CalendarTask;
}>) {
  return (
    <article className="grid grid-cols-[64px_16px_minmax(0,1fr)] items-center gap-3">
      <time className="text-right text-sm font-medium text-dashboard-muted">
        {formatTime(task.dueDate)}
      </time>
      <span
        className="relative z-10 h-3 w-3 justify-self-center rounded-full ring-4 ring-[var(--bg-surface)]"
        style={{ backgroundColor: task.projectColor }}
      />
      <div
        className={cn(
          'rounded-lg border bg-dashboard-bg/35 p-4 transition hover:bg-dashboard-raised/75',
          priorityClasses(task),
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-dashboard-text">{task.title}</h3>
            <p className="mt-2 flex items-center gap-2 truncate text-xs text-dashboard-muted">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: task.projectColor }}
              />
              {task.project}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
              className={cn(
                'grid h-7 w-7 place-items-center rounded-lg border transition',
                task.status === 'done'
                  ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
                  : 'border-dashboard-border-strong bg-dashboard-bg text-dashboard-muted hover:border-dashboard-accent/70 hover:text-dashboard-accent',
                isMutating && 'cursor-wait opacity-60',
              )}
              disabled={isMutating}
              onClick={() => onToggleTask(task)}
              type="button"
            >
              {task.status === 'done' ? <CheckIcon className="h-4 w-4" /> : null}
            </button>
            {task.priority === 'high' ? (
              <span className="rounded-full border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-1 text-xs font-semibold text-[var(--red-light)]">
                High
              </span>
            ) : null}
            <span className="text-xs font-medium text-dashboard-muted">
              {task.durationMinutes}m
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
