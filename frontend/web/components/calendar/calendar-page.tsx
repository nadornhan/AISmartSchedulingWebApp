'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarIcon, CheckIcon, ChevronRightIcon, CloseIcon, PlusIcon } from '../layout/icons';
import { onProjectDataChanged, onTaskDataChanged } from '../../lib/data-events';
import { formatDurationLabel } from '../../lib/duration';
import { listProjects, type Project } from '../../lib/projects';
import {
  createTask,
  listTasks,
  rescheduleTask,
  updateTask,
  type TaskCreateInput,
  type TaskResponse,
  type TaskStatusValue,
} from '../../lib/tasks';
import { CreateTaskModal } from '../tasks/create-task-modal';

export type CalendarTaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type CalendarTaskPriority = 'no_priority' | 'low' | 'medium' | 'high';

export type CalendarTask = {
  id: string;
  title: string;
  project: string;
  projectColor: string;
  dueDate: string;
  durationMinutes: number | null;
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

function mobilePriorityLabel(priority: CalendarTaskPriority) {
  return priority === 'no_priority'
    ? 'No priority'
    : `${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;
}

function mobilePriorityClasses(priority: CalendarTaskPriority) {
  return {
    no_priority: 'border-dashboard-border bg-dashboard-raised text-dashboard-muted',
    low: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-dashboard-accent',
    medium: 'border-[var(--orange-border)] bg-[var(--orange-soft)] text-[var(--yellow)]',
    high: 'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red-light)]',
  }[priority];
}

function mobileStatusLabel(status: CalendarTaskStatus) {
  return {
    pending: 'Pending',
    in_progress: 'In progress',
    done: 'Done',
    overdue: 'Overdue',
  }[status];
}

function mobileStatusClasses(status: CalendarTaskStatus) {
  return {
    pending: 'border-[var(--red-border)] text-[var(--red-light)]',
    in_progress: 'border-[var(--orange-border)] text-[var(--yellow)]',
    done: 'border-[var(--accent-border)] text-dashboard-accent',
    overdue: 'border-[var(--red-border)] text-[var(--red-light)]',
  }[status];
}

function calendarDotClass(task: CalendarTask) {
  if (task.status === 'done') return 'bg-dashboard-accent';
  if (task.priority === 'high') return 'bg-[var(--red-light)]';
  if (task.priority === 'medium') return 'bg-[var(--yellow)]';
  if (task.priority === 'low') return 'bg-[var(--blue-light)]';
  return 'bg-dashboard-muted';
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
    durationMinutes: task.estimated_duration_minutes,
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
          (first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime(),
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

    const currentDueDate = new Date(task.dueDate);
    const nextDueDate = new Date(date);
    nextDueDate.setHours(currentDueDate.getHours(), currentDueDate.getMinutes(), 0, 0);

    setActionError(null);
    setMutatingTaskId(task.id);
    try {
      const updated = await rescheduleTask(task.id, { due_date: nextDueDate.toISOString() });
      setCalendarTasks((current) =>
        current.map((item) =>
          item.id === task.id && updated.due_date
            ? { ...item, dueDate: updated.due_date }
            : item,
        ),
      );
      selectDate(date);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to reschedule task.');
    } finally {
      setMutatingTaskId(null);
    }
  }

  function openRescheduleDialog(task: CalendarTask) {
    const dueDate = new Date(task.dueDate);
    setRescheduleTarget(task);
    setRescheduleDate(dateKey(dueDate));
    setRescheduleTime(
      `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`,
    );
    setActionError(null);
  }

  async function submitReschedule() {
    if (!rescheduleTarget || !rescheduleDate) return;

    const nextDueDate = new Date(
      `${rescheduleDate}T${rescheduleTime ? `${rescheduleTime}:00` : '23:59:00'}`,
    );
    if (Number.isNaN(nextDueDate.getTime())) {
      setActionError('Choose a valid date and time.');
      return;
    }

    setActionError(null);
    setMutatingTaskId(rescheduleTarget.id);
    try {
      const updated = await rescheduleTask(rescheduleTarget.id, {
        due_date: nextDueDate.toISOString(),
      });
      setCalendarTasks((current) =>
        current.map((item) =>
          item.id === rescheduleTarget.id && updated.due_date
            ? { ...item, dueDate: updated.due_date }
            : item,
        ),
      );
      selectDate(nextDueDate);
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

    <section className="hidden gap-5 lg:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.95fr)]">
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

function MobileCalendarView({
  days,
  isLoading,
  loadError,
  mutatingTaskId,
  onMoveMonth,
  onReschedule,
  onSelectDate,
  onToggleTask,
  selectedDate,
  selectedKey,
  selectedTasks,
  tasksByDay,
  visibleMonth,
}: Readonly<{
  days: CalendarDay[];
  isLoading: boolean;
  loadError: string | null;
  mutatingTaskId: string | null;
  onMoveMonth: (delta: number) => void;
  onReschedule: (task: CalendarTask) => void;
  onSelectDate: (date: Date) => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedDate: Date;
  selectedKey: string;
  selectedTasks: CalendarTask[];
  tasksByDay: Record<string, CalendarTask[]>;
  visibleMonth: Date;
}>) {
  const monthLabel = new Intl.DateTimeFormat('en-AU', { month: 'short' })
    .format(visibleMonth)
    .toUpperCase();
  const selectedLabel = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(selectedDate);

  return (
    <section className="lg:hidden">
      <div className="mb-8">
        <div className="mb-5 grid grid-cols-[40px_1fr_40px] items-center">
          <button
            aria-label="Previous month"
            className="grid h-10 w-10 place-items-center rounded-full text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-accent"
            onClick={() => onMoveMonth(-1)}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <h2 className="text-center text-lg font-semibold tracking-wide text-dashboard-text">
            {monthLabel}
          </h2>
          <button
            aria-label="Next month"
            className="grid h-10 w-10 place-items-center rounded-full text-dashboard-muted transition hover:bg-dashboard-surface hover:text-dashboard-accent"
            onClick={() => onMoveMonth(1)}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {weekdayLabels.map((label) => (
            <span
              className="pb-3 text-center text-[11px] font-semibold text-dashboard-muted"
              key={label}
            >
              {label}
            </span>
          ))}

          {days.map((day) => {
            const dayTasks = tasksByDay[day.key] ?? [];
            const selected = day.key === selectedKey;
            return (
              <button
                aria-label={`${formatSelectedDate(day.date)}${dayTasks.length ? `, ${dayTasks.length} tasks` : ''}`}
                aria-pressed={selected}
                className="flex h-[52px] flex-col items-center justify-center gap-1.5"
                key={day.key}
                onClick={() => onSelectDate(day.date)}
                type="button"
              >
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-[10px] text-sm font-medium transition',
                    !day.isCurrentMonth && 'text-dashboard-subtle',
                    day.isCurrentMonth && !selected && 'text-dashboard-text',
                    selected && 'bg-dashboard-accent font-semibold text-[#042019] shadow-glow',
                    day.isToday && !selected && 'ring-1 ring-dashboard-accent/55 text-dashboard-accent',
                  )}
                >
                  {day.date.getDate()}
                </span>
                <span className="flex h-1 items-center justify-center gap-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      className={cn('h-1 w-1 rounded-full', calendarDotClass(task))}
                      key={task.id}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError ? (
        <p className="mb-5 rounded-[var(--radius-md)] border border-dashboard-danger/30 bg-dashboard-danger/10 p-4 text-sm text-dashboard-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      <div>
        <h2 className="mb-3 font-poppins text-xl font-semibold text-dashboard-text">
          {selectedLabel}
        </h2>

        {isLoading ? (
          <div className="grid min-h-36 place-items-center rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 text-sm text-dashboard-muted">
            Loading tasks...
          </div>
        ) : selectedTasks.length ? (
          <div className="divide-y divide-dashboard-border overflow-hidden rounded-[var(--radius-lg)] border border-dashboard-border bg-[#071522] shadow-panel">
            {selectedTasks.map((task) => {
              const completed = task.status === 'done';
              return (
                <article className="flex items-start gap-3 px-4 py-4" key={task.id}>
                  <button
                    aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    className={cn(
                      'mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition',
                      completed
                        ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
                        : 'border-dashboard-border-strong hover:border-dashboard-accent',
                    )}
                    disabled={mutatingTaskId === task.id}
                    onClick={() => onToggleTask(task)}
                    type="button"
                  >
                    {completed ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                  </button>

                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onReschedule(task)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-semibold text-dashboard-text">
                      {task.title}
                    </span>
                    <span className="mt-2 flex items-center gap-2 text-[11px] text-dashboard-muted">
                      <span>◷ {formatTime(task.dueDate)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: task.projectColor }}
                        />
                        <span className="truncate">{task.project}</span>
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={cn(
                        'rounded-[var(--radius-pill)] border px-2.5 py-1 text-[10px] font-medium',
                        mobilePriorityClasses(task.priority),
                      )}
                    >
                      {mobilePriorityLabel(task.priority)}
                    </span>
                    <button
                      className={cn(
                        'h-7 rounded-[var(--radius-pill)] border px-2.5 text-[10px] font-medium',
                        mobileStatusClasses(task.status),
                      )}
                      disabled={mutatingTaskId === task.id}
                      onClick={() => onToggleTask(task)}
                      type="button"
                    >
                      {mobileStatusLabel(task.status)}⌄
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center rounded-[var(--radius-lg)] border border-dashed border-dashboard-border bg-dashboard-surface/40 px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-dashboard-text">No tasks scheduled</p>
              <p className="mt-1 text-xs text-dashboard-muted">Use the + button to add a task.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CalendarMainView({
  calendarView,
  days,
  mutatingTaskId,
  onDropTask,
  onReschedule,
  onSelectDate,
  onToggleTask,
  selectedKey,
  tasksByDay,
}: Readonly<{
  calendarView: CalendarView;
  days: CalendarDay[];
  mutatingTaskId: string | null;
  onDropTask: (taskId: string, date: Date) => void;
  onReschedule: (task: CalendarTask) => void;
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
          onReschedule={onReschedule}
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
            onDropTask={onDropTask}
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
          onDropTask={onDropTask}
          tasks={tasksByDay[day.key] ?? []}
        />
      ))}
    </div>
  );
}

function DayTaskPanel({
  mutatingTaskId,
  onReschedule,
  onToggleTask,
  selectedDate,
  tasks,
}: Readonly<{
  mutatingTaskId: string | null;
  onReschedule: (task: CalendarTask) => void;
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
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {tasks.length ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <DayViewTaskCard
              isMutating={mutatingTaskId === task.id}
              key={task.id}
              onReschedule={onReschedule}
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

function DayViewTaskCard({
  isMutating,
  onReschedule,
  onToggleTask,
  task,
}: Readonly<{
  isMutating: boolean;
  onReschedule: (task: CalendarTask) => void;
  onToggleTask: (task: CalendarTask) => void;
  task: CalendarTask;
}>) {
  const priorityLabel =
    task.priority === 'no_priority'
      ? 'No priority'
      : `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`;

  return (
    <article
      className={cn(
        'group cursor-grab rounded-xl border p-4 shadow-[0_12px_32px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(0,0,0,0.22)] active:cursor-grabbing sm:p-5',
        priorityClasses(task),
        isMutating && 'cursor-wait opacity-60',
      )}
      draggable={!isMutating}
      onDragEnd={(event) => event.currentTarget.classList.remove('opacity-50')}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/calendar-task-id', task.id);
        event.currentTarget.classList.add('opacity-50');
      }}
      title="Drag to another date to reschedule"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <time className="shrink-0 rounded-lg border border-current/20 bg-dashboard-bg/45 px-3 py-2 text-sm font-semibold text-current">
            {formatTime(task.dueDate)}
          </time>
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-dashboard-text">{task.title}</h4>
            <p className="mt-2 flex items-center gap-2 text-sm text-dashboard-muted">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: task.projectColor }}
              />
              <span className="truncate">{task.project}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashboard-border-strong bg-dashboard-bg/60 px-3 text-xs font-semibold text-dashboard-muted transition hover:border-dashboard-accent/70 hover:text-dashboard-accent"
            disabled={isMutating}
            onClick={() => onReschedule(task)}
            type="button"
          >
            <CalendarIcon className="h-4 w-4" />
            Reschedule
          </button>
          <button
            aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition',
              task.status === 'done'
                ? 'border-dashboard-accent bg-dashboard-accent text-dashboard-bg'
                : 'border-dashboard-border-strong bg-dashboard-bg/60 text-dashboard-muted hover:border-dashboard-accent/70 hover:text-dashboard-accent',
            )}
            disabled={isMutating}
            onClick={() => onToggleTask(task)}
            type="button"
          >
            <span className="grid h-4 w-4 place-items-center rounded border border-current/50">
              {task.status === 'done' ? <CheckIcon className="h-3 w-3" /> : null}
            </span>
            {task.status === 'done' ? 'Completed' : 'Complete'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-current/10 pt-3">
        <span className="rounded-full border border-current/20 bg-dashboard-bg/35 px-2.5 py-1 text-xs font-semibold text-current">
          {priorityLabel}
        </span>
        {task.durationMinutes !== null ? (
          <span className="rounded-full border border-dashboard-border bg-dashboard-bg/35 px-2.5 py-1 text-xs font-medium text-dashboard-muted">
            {formatDurationLabel(task.durationMinutes)} estimated
          </span>
        ) : null}
        <span className="ml-auto text-xs font-medium text-dashboard-muted">
          Due {formatTime(task.dueDate)}
        </span>
      </div>
    </article>
  );
}

function CalendarDayCell({
  day,
  isSelected,
  onDropTask,
  onSelect,
  tasks,
  variant = 'month',
}: Readonly<{
  day: CalendarDay;
  isSelected: boolean;
  onDropTask: (taskId: string, date: Date) => void;
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
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const taskId = event.dataTransfer.getData('text/calendar-task-id');
        if (taskId) onDropTask(taskId, day.date);
      }}
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
      draggable
      onDragEnd={(event) => event.currentTarget.classList.remove('opacity-50')}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/calendar-task-id', task.id);
        event.currentTarget.classList.add('opacity-50');
      }}
      title="Drag to another date to reschedule"
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
  onReschedule,
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
  onReschedule: (task: CalendarTask) => void;
  onShowCompletedChange: () => void;
  onToday: () => void;
  onToggleTask: (task: CalendarTask) => void;
  selectedDate: Date;
  showCompleted: boolean;
  tasks: CalendarTask[];
}>) {
  return (
    <aside className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 p-5 shadow-panel">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dashboard-accent">
            Daily agenda
          </p>
          <h2 className="mt-1 truncate font-poppins text-xl font-medium tracking-[-0.02em] text-dashboard-text">
            {formatSelectedDate(selectedDate)}
          </h2>
          <p className="mt-1 text-xs text-dashboard-muted">
            {tasks.length} {tasks.length === 1 ? 'scheduled task' : 'scheduled tasks'}
          </p>
        </div>
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
            <div className="absolute bottom-0 left-[78px] top-0 w-px bg-gradient-to-b from-dashboard-accent/35 via-dashboard-border to-transparent" />
            <div className="space-y-3">
              {tasks.map((task) => (
                <AgendaTask
                  isMutating={mutatingTaskId === task.id}
                  key={task.id}
                  onReschedule={onReschedule}
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

      <label className="mt-6 flex w-fit items-center gap-3 text-[13px] font-medium text-dashboard-muted">
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
  onReschedule,
  onToggleTask,
  task,
}: Readonly<{
  isMutating: boolean;
  onReschedule: (task: CalendarTask) => void;
  onToggleTask: (task: CalendarTask) => void;
  task: CalendarTask;
}>) {
  const priorityLabel =
    task.priority === 'no_priority'
      ? 'No priority'
      : `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`;

  return (
    <article
      className="grid cursor-grab grid-cols-[58px_14px_minmax(0,1fr)] items-center gap-3 active:cursor-grabbing"
      draggable={!isMutating}
      onDragEnd={(event) => event.currentTarget.classList.remove('opacity-50')}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/calendar-task-id', task.id);
        event.currentTarget.classList.add('opacity-50');
      }}
      title="Drag to another date to reschedule"
    >
      <time className="text-right text-xs font-semibold tabular-nums tracking-[-0.01em] text-dashboard-muted">
        {formatTime(task.dueDate)}
      </time>
      <span
        className="relative z-10 h-2.5 w-2.5 justify-self-center rounded-full shadow-[0_0_0_4px_var(--bg-surface),0_0_12px_currentColor]"
        style={{ backgroundColor: task.projectColor }}
      />
      <div
        className={cn(
          'rounded-xl border bg-dashboard-bg/35 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:bg-dashboard-raised/75 hover:shadow-[0_14px_34px_rgba(0,0,0,0.2)]',
          priorityClasses(task),
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-poppins text-[15px] font-medium tracking-[-0.01em] text-dashboard-text">
              {task.title}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashboard-border-strong bg-dashboard-bg/70 px-2.5 text-[11px] font-semibold text-dashboard-muted transition hover:border-dashboard-accent/70 hover:text-dashboard-accent"
              disabled={isMutating}
              onClick={() => onReschedule(task)}
              type="button"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Reschedule
            </button>
            <button
              aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg border transition',
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
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-current/10 pt-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-dashboard-muted">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: task.projectColor }}
            />
            <span className="truncate">{task.project}</span>
          </span>
          <span className="rounded-full border border-current/20 bg-dashboard-bg/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-current">
            {priorityLabel}
          </span>
          {task.durationMinutes !== null ? (
            <span className="ml-auto text-[11px] font-semibold tabular-nums text-dashboard-muted">
              {formatDurationLabel(task.durationMinutes)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RescheduleDialog({
  date,
  error,
  isSubmitting,
  onClose,
  onDateChange,
  onSubmit,
  onTimeChange,
  task,
  time,
}: Readonly<{
  date: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
  onTimeChange: (value: string) => void;
  task: CalendarTask;
  time: string;
}>) {
  return (
    <div
      aria-labelledby="reschedule-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[350] grid place-items-center overflow-y-auto bg-[#000306]/80 p-4 backdrop-blur-[5px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSubmitting) onClose();
      }}
      role="dialog"
    >
      <form
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-[var(--bg-surface-raised)] p-6 shadow-[0_32px_100px_rgba(0,0,0,.6)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              className="text-xl font-semibold text-dashboard-text"
              id="reschedule-dialog-title"
            >
              Reschedule task
            </h2>
            <p className="mt-1 truncate text-sm text-dashboard-muted">{task.title}</p>
          </div>
          <button
            aria-label="Close reschedule dialog"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-text"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-dashboard-text">Due date</span>
            <input
              className="h-11 w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none [color-scheme:dark] focus:border-dashboard-accent"
              disabled={isSubmitting}
              onChange={(event) => onDateChange(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-dashboard-text">Time</span>
            <input
              className="h-11 w-full rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm text-dashboard-text outline-none [color-scheme:dark] focus:border-dashboard-accent"
              disabled={isSubmitting}
              onChange={(event) => onTimeChange(event.target.value)}
              type="time"
              value={time}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-dashboard-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="h-10 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-4 text-sm font-medium text-dashboard-text transition hover:border-dashboard-border-strong"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-[var(--radius-sm)] bg-dashboard-accent px-4 text-sm font-semibold text-dashboard-bg transition hover:bg-dashboard-accent/90 disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting || !date}
            type="submit"
          >
            {isSubmitting ? 'Rescheduling...' : 'Save schedule'}
          </button>
        </div>
      </form>
    </div>
  );
}
