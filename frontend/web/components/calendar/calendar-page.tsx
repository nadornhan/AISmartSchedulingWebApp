'use client';

import { useMemo, useState } from 'react';
import { CheckIcon, ChevronRightIcon, PlusIcon } from '../layout/icons';
import { mockTasks } from './mock-calendar-tasks';

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

export function CalendarPage() {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(2026, 11, 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 11, 30));
  const [activeFilter, setActiveFilter] = useState<'all' | 'tasks' | 'focus'>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const visibleTasks = useMemo(
    () =>
      mockTasks
        .filter((task) => showCompleted || task.status !== 'done')
        .sort((first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime()),
    [showCompleted],
  );
  const tasksByDay = useMemo(() => groupTasks(visibleTasks), [visibleTasks]);
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const selectedKey = dateKey(selectedDate);
  const selectedTasks = tasksByDay[selectedKey] ?? [];

  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function moveSelectedDate(delta: number) {
    setSelectedDate((current) => addDays(current, delta));
  }

  function goToToday() {
    const today = new Date();
    setSelectedDate(today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.95fr)]">
      <div className="rounded-[var(--radius-lg)] border border-dashboard-border bg-dashboard-surface/65 shadow-panel">
        <div className="flex flex-col gap-4 border-b border-dashboard-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Previous month"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
            </button>
            <button
              aria-label="Next month"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-dashboard-border bg-dashboard-raised text-dashboard-muted transition hover:border-dashboard-accent/60 hover:text-dashboard-accent"
              onClick={() => moveMonth(1)}
              type="button"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
            <h2 className="truncate text-xl font-semibold text-dashboard-text">
              {formatMonthTitle(visibleMonth)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-dashboard-border bg-dashboard-bg/45 p-1">
              {(['Month', 'Week', 'Day'] as const).map((view) => (
                <button
                  aria-pressed={view === 'Month'}
                  className={cn(
                    'h-9 rounded-md px-4 text-sm font-medium transition',
                    view === 'Month'
                      ? 'bg-dashboard-accent-soft text-dashboard-accent ring-1 ring-dashboard-accent/40'
                      : 'text-dashboard-muted',
                    view !== 'Month' && 'cursor-not-allowed opacity-50',
                  )}
                  disabled={view !== 'Month'}
                  key={view}
                  type="button"
                >
                  {view}
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

        <div className="grid grid-cols-7">
          {days.map((day) => (
            <CalendarDayCell
              day={day}
              isSelected={day.key === selectedKey}
              key={day.key}
              onSelect={() => setSelectedDate(day.date)}
              tasks={tasksByDay[day.key] ?? []}
            />
          ))}
        </div>
      </div>

      <DayAgenda
        onNextDay={() => moveSelectedDate(1)}
        onPreviousDay={() => moveSelectedDate(-1)}
        onShowCompletedChange={() => setShowCompleted((current) => !current)}
        onToday={goToToday}
        selectedDate={selectedDate}
        showCompleted={showCompleted}
        tasks={selectedTasks}
      />
    </section>
  );
}

function CalendarDayCell({
  day,
  isSelected,
  onSelect,
  tasks,
}: Readonly<{
  day: CalendarDay;
  isSelected: boolean;
  onSelect: () => void;
  tasks: CalendarTask[];
}>) {
  const visibleTasks = tasks.slice(0, 2);
  const overflowCount = tasks.length - visibleTasks.length;

  return (
    <button
      className={cn(
        'min-h-[118px] border-r border-t border-dashboard-border bg-dashboard-bg/10 p-3 text-left transition last:border-r-0 hover:bg-dashboard-surface/65 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-dashboard-accent/50',
        !day.isCurrentMonth && 'bg-dashboard-bg/30 text-dashboard-subtle',
        isSelected && 'relative z-10 bg-dashboard-accent-soft ring-2 ring-inset ring-dashboard-accent/70',
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="mb-3 flex items-center justify-between">
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

      <div className="space-y-1.5">
        {visibleTasks.map((task) => (
          <CalendarTaskCard compact key={task.id} task={task} />
        ))}
        {overflowCount > 0 ? (
          <p className="text-xs font-medium text-dashboard-muted">+{overflowCount} more</p>
        ) : null}
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
      <p className={cn('mt-0.5 truncate text-xs font-medium', compact ? 'opacity-85' : 'opacity-75')}>
        {formatTime(task.dueDate)}
      </p>
    </div>
  );
}

function DayAgenda({
  onNextDay,
  onPreviousDay,
  onShowCompletedChange,
  onToday,
  selectedDate,
  showCompleted,
  tasks,
}: Readonly<{
  onNextDay: () => void;
  onPreviousDay: () => void;
  onShowCompletedChange: () => void;
  onToday: () => void;
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
        {tasks.length ? (
          <>
            <div className="absolute bottom-0 left-[84px] top-0 w-px bg-dashboard-border" />
            <div className="space-y-4">
              {tasks.map((task) => (
                <AgendaTask key={task.id} task={task} />
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

function AgendaTask({ task }: Readonly<{ task: CalendarTask }>) {
  return (
    <article className="grid grid-cols-[64px_16px_minmax(0,1fr)] items-center gap-3">
      <time className="text-right text-sm font-medium text-dashboard-muted">{formatTime(task.dueDate)}</time>
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
            {task.priority === 'high' ? (
              <span className="rounded-full border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-1 text-xs font-semibold text-[var(--red-light)]">
                High
              </span>
            ) : null}
            <span className="text-xs font-medium text-dashboard-muted">{task.durationMinutes}m</span>
          </div>
        </div>
      </div>
    </article>
  );
}
